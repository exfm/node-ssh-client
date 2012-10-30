# node-ssh-client

A simple SSH client for node.


## Example

    var ssh = require('ssh-client');
    var username = '',
        host = '';

    var client = ssh(username, host, function(){
        client.exec('ls -alh', function(err, out){
            console.log('ls result', out);
            client.exec('pwd', function(err, out){
                console.log('pwd', out);
                client.close();
            });
        });
    });

## Install

     npm install node-ssh-client

## Testing

    git clone
    npm install
    mocha

## License

MIT