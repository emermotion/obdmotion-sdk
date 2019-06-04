# Obdmotion SDK

## Table of Contents

- [Class: DeviceManager](#class-devicemanager)
  - [new DeviceManager(options)](#new-devicemanageroptions)
  - [Event: 'close'](#event-close)
  - [Event: 'connection'](#event-connection)
  - [Event: 'error'](#event-error)
  - [server.connections](#devicemanagerconnections)

- [Class: DeviceConnection](#class-deviceconnection)
  - [new DeviceConnection(options)](#new-deviceconnectionoptions)
  - [Event: 'close'](#event-close-1)
  - [Event: 'error'](#event-error-1)
  - [Event: 'message'](#event-message)
  - [Event: 'ping'](#event-ping)
  - [DeviceConnection.close()](#deviceconnectionclose)
  - [DeviceConnection.terminate()](#deviceconnectionterminate)
  - [DeviceConnection.send(data,callback)](#deviceconnectionsend)

## Class: DeviceManager

This class uses a `WebSocket` Server to implement all the Obdmotion features. It extends the `EventEmitter`.

### new DeviceManager(options)

  - `options` {Object} Options for server creation.
    - `port` {Integer} Port to listen.
    - `path` {String} Path to listen.
    - `handshake` {Object} Options for connection's handshake.
      - `timeout` {Integer} Timeout to reach a successfull handshake.
      - `algorithm` {String} Algorithm for hmac.
      - `nonce_size` {Integer} Size of nonce.
    - `connections` {Object} Options for incoming connections.
      - `timeout` {Integer} Timeout for devices connections.
      - `messages` {Object} Options for incoming connections messages.
      - `timeout` {Integer} Timeout for message's response.
      - `queue_limit` {Integer} Maximum pending messages.

### Event: 'close'

Emitted when the server closes. This event depends on the `'close'` event of
WebSocket Server only when it is created internally.

### Event: 'connection'

- `connection` {DeviceConnection}

Emitted when the handshake of a new device connection is complete.

### Event: 'error'

- `error` {Error}

Emitted when an error occurs on the underlying server.

### server.connections

- {Object}

A object that stores all current device connections.

## Class: DeviceConnection

This class implements an Obdmotion device connection. It extends the `EventEmitter`.

### new DeviceConnection(options)

  - `id` {Integer} Connection Id.
  - `device` {Integer} Device Id.
  - `_socket` {Object} Connections websocket.
  - `ip_address` {String} Connection IP address.
  - `_messages` {Object} Current connection's messages.
    - `counter` {Integer} counter New message id.
    - `timeout` {Integer} timeout Response timeout for messages.
    - `limit` {Integer} limit Max size for messages list.
  - `timeout` {Integer} Connection timeout.
  - `_timeout_handler` {Object} Timeout handler.
  - `_last_id` {Integer} Last message's id.

### Event: 'close'

- `reason` {String}

Emitted when the connection is closed. `reason` is a
human-readable string explaining why the connection has been closed.

### Event: 'error'

- `error` {Error}

Emitted when an error occurs.

### Event: 'message'

- `message` {Object}

Emitted when a message is received from the device.

### Event: 'ping'

Emitted when a ping is received from the device.

### DeviceConnection.close()

Stats a close negotiation.

### DeviceConnection.terminate()

Forcibly close the connection.

### DeviceConnection.send(message, callback)

  - `message` {Object} Message to be sent.
  - `callback` {Function} Called when the response is received.
