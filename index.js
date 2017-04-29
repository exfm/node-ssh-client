"use strict";


var util = require('util');
var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var child_process = require('child_process');
var spawn = child_process.spawn;
var exec = child_process.exec;

module.exports = (username, host, connectcb) => new SSHClient(username, host, connectcb);

function SSHClient(username, host, connectcb){
    var self = this;
    var outBuff = "";
    var out;

    this.username = username;
    this.host = host;
    this.ready = false;
    this.queue = [];
    this.command = null;
    this.lastError = null;
    this.cb = null;
    this.interval = null;
    this.working = true;
    this.connected = false;
    this.killedSafe = false;



    this.ssh = spawn('ssh', ['-t', '-t', username + '@' + host]);
    this.ssh.stdout.on('data', data => {
        if(self.connected === false){
            self.connected = true;
            self.working = false;
            return self.exec('pwd', () => {
                self.emit('connect');
            });
        }

        var isEnd = data.toString().indexOf('__SSHCLIENT__\r\n') > -1;
        outBuff += data.toString();

        if(self.cb && isEnd){
            outBuff = outBuff.split("echo __SSHCLIENT__;\r\n");
            out = (outBuff[1] && outBuff[1].length > 0) ? outBuff[1] : 'OK: ' + outBuff[0];
            out = out.replace("\r\n__SSHCLIENT__\r\n", "");
            self.emit('data', out);

            self.cb(null, out);

            outBuff = "";
            self.cb = null;
        }
        self.working = false;
    });

    this.ssh.stderr.on('data', function (data) {
        // console.log('stderr: ', data.toString());
        if(data.toString() === "Pseudo-terminal will not be allocated because stdin is not a terminal.\r\n"){
            return;
        }
        if(data.toString() === "Killed by signal 1.\r\n"){
            return this.emit('close');
        }
        if(data.toString().toLowerCase().indexOf('warn') > -1){
            return;
        }
        if(data.toString().indexOf('No README.md' > -1)){
            return;
        }
        self.lastError = data.toString();

        if(self.cb){
            self.cb(new Error(data.toString()), null);
            self.cb = null;
        }
        self.working = false;
    });

    this.ssh.on('exit', (code, signal) => {
        if(code !==0 && self.killedSafe === false){
            setTimeout(() => {
                console.error('Exited', self.lastError);
                self.emit('error', self.lastError);
            }, 50);
        }
    });

    this.on('connect', () => {
        self.working = false;

        connectcb();

        if(self.queue.length === 0){
            return;
        }
    });

    this.interval = setInterval(() => {
        if(self.queue.length > 0 && self.working === false){
            var d = self.queue.shift();
            var s = '';
            self.cb = d[1];
            self.working = true;
            self.emit('sending', d[0]);

            if(d[0].charAt(d[0].length - 1) !== "&"){
                s = ";";
            }
            self.ssh.stdin.write(d[0] + s + " echo __SSHCLIENT__;\n");
        }
    }, 100);
}
util.inherits(SSHClient, EventEmitter);

SSHClient.prototype.exec = function(cmd, cb){
    this.queue.push([cmd, cb]);
};

SSHClient.prototype.close = function(){
    clearInterval(this.interval);
    this.killedSafe = true;
    this.ssh.kill('SIGHUP');
};

SSHClient.prototype.cd = function(dir, cb){
    this.exec("cd " + dir, cb);
};

SSHClient.prototype.mkdir = function(dir, cb){
    this.exec("mkdir -p " + dir, cb);
};

SSHClient.prototype.put = function(contents, remotePath, cb){
    var tmpPath = 'file.' + (Math.random() * 100);
    var self = this;

    fs.writeFile(tmpPath, contents, 'utf-8', err => {
        self.putFile(tmpPath, remotePath, (err, stdout, stderr) => {
            fs.unlink(tmpPath, () => {
                cb(err, stdout, stderr);
            });
        });
    });
};

SSHClient.prototype.putFile = function(localPath, remotePath, cb){
    var c = [
        'scp',
        localPath,
        this.username + '@' + this.host + ':' + remotePath
    ];

    exec(c.join(' '), (error, stdout, stderr) => {
        cb(error, stdout, stderr);
    });
};


function LocalClient(){

}

LocalClient.prototype.cd = (dir, cb) => {
    exec('cd ' + dir, (err, stdout, stderr) => {
        cb(err, stdout, stderr);
    });
};

LocalClient.prototype.close = () => {
    // Nada?
};

LocalClient.prototype.exec = (cmd, cb) => {
    exec(cmd, cb);
};

LocalClient.prototype.mkdir = function(dir, cb){
    this.exec('mkdir -p ' + dir, cb);
};

LocalClient.prototype.put = function(contents, remotePath, cb){
    var tmpPath = 'file.' + (Math.random() * 100);
    var self = this;
    fs.writeFile(tmpPath, contents, 'utf-8', err => {
        self.putFile(tmpPath, remotePath, (err, stdout, stderr) => {
            fs.unlink(tmpPath, () => {
                cb(err, stdout, stderr);
            });
        });
    });
};

// Move
LocalClient.prototype.putFile = function(localPath, remotePath, cb){
    this.exec('mv ' + localPath + ' ' + remotePath, cb);
};
