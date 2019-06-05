# COMM Protocol

## Table of Contents

- [Introduction](#introduction)
- [Messages overview](#messages-overview)
  - [Session](#session)
  - [Request and Response](#request-and-response)
- [Session](#session-1)
  - [hello](#hello)
  - [challenge](#challenge)
  - [authenticate](#authenticate)
  - [welcome](#welcome)
  - [goodbye](#goodbye)
  - [ack](#ack)
- [Request](#request)
  - [info / stat / data](#info-/-stat-/-data)
  - [ctrl](#ctrl)
- [Response](#response)
  - [info / stat / data](#info-/-stat-/-data-1)
  - [ctrl](#ctrl-1)
- [Resources](#resources)
  - [Info](#info)
  - [Stat](#stat)
  - [Data](#data)
  - [Ctrl](#ctrl-2)
  - [Configuration](#configuration)
    - [Data Parameters](#data-parameters)
- [Anexx](#annex)
  - [Response Codes](#response-codes)
  - [Examples](#examples)

## Introduction

Messages are sent and received over `Websocket` protocol. Server application
must meet the following requirements:

- Device acts as client.
- Destination IP/port/path can be configured at any time.
- SSL/TLS layer can be enabled.
- All frames coming from device are masked.
- Masked frames received from Server will be discarded.
- Max frame payload size is 1024 bytes.
- No fragmentation supported (websocket continuation frames).
- Closing handshake initiated from server is not supported. If server closes the underlying TCP connection, device will wait a random delay between 20s and 80s before retry.
- Server must wait at least 1s before sending any frame after the opening handshake.
- If connection is idle (i.e. no frames are sent or received), the device automatically sends a keep alive to server every 10 minutes (websocket ping frame).

## Message overview
All messages (inbound and outbound) must be formatted using JSON format.

### Session

| Type | Description | Source |
| ---- | ----------- | ------ |
| hello        | Session start                                  | Device        |
| challenge    | Session authentication                         | Server        |
| authenticate | Session authentication (response to challenge) | Device        |
| welcome      | Session validated                              | Server        |
| goodbye      | Session end                                    | Device        |
| ack          | message acknowledge (for request / response)   | Device/Server |

### Request and Response

| Type | Description | Source |
| ---- | ----------- | ------ |
| info | Vehicle information    | Device/Server |
| stat | Vehicle status         | Device/Server |
| data | Vehicle data report    | Device/Server |
| ctrl | Vehicle remote control | Server        |

## Session
Once the `WebSocket` channel is successfully opened, and before any request or response can be received/sent, the device needs to start a session layer based in the classic challenge/response mechanism.
This method provides a secure way of client side authentication. Private and public keys are factory predefined. If the signature received does not match with the computed one, server side
must close the connection immediately.
After the CRA, each request or response must be acknowledged from device/server, respectively. The `ack` type message is part of session layer and only have to carry the message identifier. Various requests can be sent to device at the same time. Device will acknowledge in order of arrival.

### hello
```
{“type”:”hello”,”public_key”:<string>}
```
| Key | Value |
| --- | ----- |
| public_key | Device unique, base64 encoded, length: 8 |

### challenge
```
{“type”:”challenge”,”nonce”:<string>}
```
| Key | Value |
| --- | ----- |
| nonce | Random value, base64 encoded, length: 32 |

### authenticate
```
{“type”:”authenticate”,”sign”:<string>}
```
| Key | Value |
| --- | ----- |
| sign | HMAC[SHA-1]_{private_key}(nonce), length: 27 |

### welcome
```
{“type”:”welcome”}
```

### goodbye
```
{“type”:”goodbye”}
```

### ack
```
{“type”:”ack”,”id”:<number>}
```
| Key | Value |
| --- | ----- |
| id | The id of the request/response message |

## Request
`info`, `stat`, `data` request messages are used to manually get some resource value. They can be sent at any time, even with automatic response activated.
`ctrl` request messages are used to manually initiate an action. They can be
sent at any time too.
Request `id` is an 8-bit counter integer auto-incremented at server side with automatic rollover.
The union between the request `type` and the request `key` establish an unique way to identify a resource.

### info / stat / data
```
{“id”:<number>,“type”:<string>,”key”:<string>}
```
| Key | Value |
| --- | ----- |
| id   | message id [0-255]               |
| type | request type (e.g. data)         |
| key  | resource identifier (e.g. speed) |

## Response
`info`, `stat`, `data` response messages carry the resource value, status code and
timestamp.
They are sent after a request or automatically. Automatic responses can be configured to obtain a resource value without the need of polling.
`ctrl` response messages carry the result of an invoked action through the status code.
Response `id` is an 8-bit counter integer auto-incremented at device side with automatic rollover.
Response `timestamp` can be configured to be `UTC` or `GMT`. The format can also be configured, between Epoch and RFC3339.

### info / stat / data
```
{
  “id”:<number>,
  “type”:<string>,
  ”key”:<string>,
  ”code”:<number>,
  ”time”:<number|string>,
  ”val”:<string|number|aray>
}
```
| Key | Value |
| --- | ----- |
| id   | message id [0-255]                   |
| type | response type (e.g. data)            |
| key  | resource identifier (e.g. speed)     |
| code | response status code                 |
| time | timestamp                            |
| val  | (optional) resource value (e.g. 125) |

### ctrl
```
{
  “id”:<number>,
  “type”:ctrl,
  ”key”:<string>,
  ”code”:<number>,
  ”time”:<number|string>
}
```
| Key | Value |
| --- | ----- |
| id   | message id [0-255]              |
| key  | resource identifier (e.g. horn) |
| code | response status code            |
| time | timestamp                       |

## Resources
### Info
| Key | Description | Value |
| --- | ----------- | ----- |
| brand | vehicle brand      | string |
| model | vehicle model      | string |
| year  | vehicle model year | 20XX   |
| fuel  | fuel type          | string |
| tank  | fuel tank capacity | 0-255L |

### Stat
| Key | Description | Value |
| --- | ----------- | ----- |
| power    | vehicle battery status  | 0-Disconnected<br/>1-Connected                   |
| system   | vehicle system status   | 0-Sleep<br/>1-Active                             |
| ignition | vehicle ignition        | 0-Off<br/>1-On                                   |
| engine   | vehicle engine status   | 0-Off<br/>1-On                                   |
| diag     | vehicle diag status     | 0-Not detected<br/>1-Detected<br/>2-Locked       |
| body     | vehicle body status     | 0-Calm<br/>1-Tamper<br/>2-Knock<br/>3-Knock down |
| move     | vehicle movement status | 0-Stopped<br/>1-Moving                           |

### Data
| Key | Description | Value |
| --- | ----------- | ----- |
| gps        | GPS location [lat,lng,alt,course] | [±dd.dddddd,±ddd.dddddd,m,deg] |
| accel      | longitudinal acceleration         | [g]                            |
| vbat       | vehicle battery voltage           | [V]                            |
| rpm        | engine speed                      | [rpm]                          |
| temp_eng   | engine temperature                | [C]                            |
| temp_amb   | ambient temperature               | [C]                            |
| fuel_level | fuel level                        | [%]                            |
| fuel_rate  | fuel consumption (instant)        | [L/h]                          |

### Ctrl
TBD

### Configuration

| mode | description |
| ---- | ----------- |
| SEL_OFF | Resource disabled |
| SEL_ON_DEMAND (1) | Values need to be requested manuallly |
| SEL_ON_CHANGE (2) | Values are sent only if change occurs |
| SEL_ON_SAMPLE (3) | Values are sampled at a fixed period and packed into arrays |

  (1) Request/response mode. Also available with on_change and on_sample mode
  (2) Auto response mode. Not available for ctrl type.
  (3) Auto response mode. Only available for data type.

#### Data parameters
| Key | SEL_ON_SAMPLE period | SEL_ON_SAMPLE max | SEL_ON_CHANGE threshold |
| --- | -------------------- | ----------------- | ----------------------- |
| gps        | 1s   | 20 | ±10deg (lat or lng) |
| accel      | 50ms | 50 | ±100mg              |
| vbat       | 10s  | 25 | ±0.1V               |
| rpm        | 1s   | 50 | ±200rpm             |
| speed      | 1s   | 20 | ±5km/h              |
| temp_eng   | 30s  | 50 | ±2C                 |
| temp_amb   | 60s  | 10 | ±2C                 |
| fuel_level | 120s | 10 | ±5%                 |
| fuel_rate  | 2s   | 25 | ±0.5L/h             |

## ANNEX

### RESPONSE CODES
| Code | Meaning |
| ---- | ------- |
| 0  | OK       |
| 1  | OK_AUTO  |
| 3  | reserved |
| 4  | reserved |
| 5  | reserved |
| 6  | reserved |
| 7  | reserved |
| 8  | reserved |
| 9  | reserved |
| 10 | ERROR    |
| 11 | ERROR_NOT_SUPPORTED |
| 12 | ERROR_NOT_SELECTED  |
| 13 | ERROR_NOT_AVAILABLE |
| 14 | reserved |
| 15 | reserved |
| 16 | reserved |
| 17 | reserved |
| 18 | reserved |
| 19 | reserved |
| 20 | reserved |


## EXAMPLES
### Session start
```
<= {"type":"hello","public_key":"7dtCt_12"}
=> {"type":"challenge","nonce":"AUbS3z5tXiaLRf2FNUqNVWxXpmTpMey8"}
<= {"type":"authenticate","sign":"wwFR05_yMayfxbK79K-vylcrgSY="}
=> {"type":"welcome"}
```

### Speed request
```
=> {"id":27,"type":"data","key":"speed"}
<= {"type":"ack","id":27}
<= {"id":94,"type":"data","key":"speed","code":0,"time":"2018-05-
14T20:18:26","val":125}
=> {"type":"ack","id":94}
```
### Speed response (automatic)
```
<= {"id":77,"type":"data","key":"speed","code":1,"time":"2018-05-
14T20:18:26",”val”:[118,124,128,128,132,130,130,130,130,130,130]}
=> {"type":"ack","id":77}
```
