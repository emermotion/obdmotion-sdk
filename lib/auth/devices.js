'use strict';

const crypto = require('crypto');

function challenge_method(connection, options, callback){
  if(typeof(callback) != 'function'){
    return;
  }

  var device = undefined;
  var nonce  = undefined;

  var timeout = setTimeout(function(){
    connection.removeAllListeners('message');
    callback('Handshake timeout');
  }, options.timeout);

  // Get first message
  connection.on('message', function(message){

    // Parse message
    try {
      message = JSON.parse(message);
    } catch(e) {
      clearTimeout(timeout);
      callback('JSON parse error ('+message+')');
    }

    // Check format
    if(message && message.type === 'hello' && message.public_key != null){

      // Check sequence
      if(nonce == null && device == null){

        // Find device by public_key
        find_device(message.public_key, function(err, res){
          if(err){
            clearTimeout(timeout);
            callback(err);
          } else {
            // Build nonce
            device = res;
            nonce = crypto.randomBytes(options.nonce_size).toString('base64');

            // Send challenge
            connection.send(JSON.stringify({ type: 'challenge', nonce: nonce }));
          }
        });
      } else {
        clearTimeout(timeout);
        callback('Bad sequence ('+ JSON.stringify(message) +')');
      }
    } // Check format
      else if(message && message.type === 'authenticate'){

        // Check sequence
        if(device != null && nonce != null){

          // Create signature
          var hmac = crypto.createHmac(options.algorithm, device.private_key);
          hmac.update(nonce);
          const expected_signature = hmac.digest('base64');

          if(message.sign == expected_signature){
            // Clear Listeners and timeout
            clearTimeout(timeout);
            connection.removeAllListeners('message');

            // Send welcome and callback
            connection.send(JSON.stringify({ type: "welcome" }));
            callback(null, device.id);

          } else {
            clearTimeout(timeout);
            callback('Bad signature ('+ JSON.stringify(message) +')');
          }

      } else {
        clearTimeout(timeout);
        callback('Bad sequence ('+ JSON.stringify(message) +')');
      }
    } else {
      clearTimeout(timeout);
      callback('Bad format ('+ JSON.stringify(message) +')');
    }
  });
}

function find_device(public_key, callback){
  if(typeof(callback) != 'function'){
    return;
  }

  /**
   * TO FILL BY THE USER
   *
   * This method should search on your persistence unit for the device by its public key
   * And should return two objects via callback with the given structure:
   *
   *  @param {Object} error
   *  @param {Object} result
   *  @param {Number} result.id  Identificator of your device
   *  @param {String} result.public_key   Public key given by Emermotion
   *  @param {String} result.private_key  Private key given by Emermotion
   *
   */
}

module.exports = {
  challenge_method: challenge_method
}
