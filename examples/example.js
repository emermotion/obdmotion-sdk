'use strict';

const DeviceManager = require('../lib/device_manager.js');

const configuration = {
  port: 7000,
  path: "/",
  handshake: {
    timeout: 90000,
    algorithm: "sha1",
    nonce_size: 24
  },
  connections: {
    timeout: 720000,
    messages: {
      timeout: 60000,
      queue_limit: 256
    }
  }
};

var device_manager = new DeviceManager(configuration);

var tracks = {};

device_manager.on('connection', function(connection){
  console.info('Device %i > Connected', connection.device);

  connection.on('error', function(err){
    console.error('Device %i > %s', connection.device, err);
  });

  connection.on('timeout', function(){
    console.log('Device %i > Timeout', connection.device);
  });

  connection.on('close', function(reason){
    console.log('Device %i > Closed Reason: %s', connection.device, reason);
  });

  connection.on('message', function(message){
    // Print message
    try {
      console.info('Device %i > Data: %s', connection.device, JSON.stringify(message));
    } catch(err) {
      console.error(err);
    }
  });
});
