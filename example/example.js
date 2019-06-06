'use strict';

const DeviceManager = require('..');
const db = require('./db.json');

function find_device(public_key, callback){
  if(typeof(callback) != 'function'){
    return;
  }

  var i = 0;
  var keys = Object.keys(db);
  while( i < keys.length && db[keys[i]].public_key != public_key ) i++;

  if(i==keys.length){
    callback('Unkown');
  } else {
    callback(null, db[keys[i]]);
  }
}

const configuration = {
  port: 7000,
  path: "/",
  find_device: find_device,
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
