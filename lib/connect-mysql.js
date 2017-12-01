/*!
 * connect-mysql
 * Author: Nathan LaFreniere <nlf@andyet.net>
 */

var util = require('util');
var crypto = require('crypto');


function isFunction(obj) {
  return Object.prototype.toString.call(obj) == '[object Function]';
}


function isNumber(obj) {
  return Object.prototype.toString.call(obj) == '[object Number]';
}


function encryptData(plaintext, secret, algo) {
  var hmac = digest(secret, plaintext);

  var obj = {
    hmac: hmac,
    pt: plaintext
  };

  var ct = encrypt(secret, JSON.stringify(obj), algo);

  return ct;
}


function decryptData(ciphertext, secret) {
  var pt = decrypt(secret, ciphertext);
  var obj = JSON.parse(pt);
  var hmac = digest(secret, obj.pt);

  if (hmac != obj.hmac) {
    throw 'Encrypted session was tampered with!';
  }

  return obj.pt;
}


function digest(key, obj) {
  var hmac = crypto.createHmac('sha512', key);
  hmac.setEncoding('hex');
  hmac.write(obj);
  hmac.end();
  return hmac.read();
}


function encrypt(key, pt, algo) {
  algo = algo || 'aes-256-ctr';
  pt = (Buffer.isBuffer(pt)) ? pt : new Buffer(pt);

  var cipher = crypto.createCipher(algo, key);
  var ct = [];

  ct.push(cipher.update(pt, 'buffer', 'hex'));
  ct.push(cipher.final('hex'));

  return ct.join('');
}


function decrypt(key, ct, algo) {
  algo = algo || 'aes-256-ctr';
  var cipher = crypto.createDecipher(algo, key);
  var pt = [];

  pt.push(cipher.update(ct, 'hex', 'utf8'));
  pt.push(cipher.final('utf8'));

  return pt.join('');
}


module.exports = function(connect) {
  var Store = connect.Store || connect.session.Store,
      TableName = 'sessions';

  function MySQLStore(options) {
    var cleanup = true,
        heartbeat = 30000;

    Store.call(this, options);

    if (options.hasOwnProperty('cleanup'))
      cleanup = options.cleanup;

    if (options.hasOwnProperty('table'))
      TableName = options.table;

    if (options.hasOwnProperty('retries'))
      this.numRetries = options.retries;

    if (options.hasOwnProperty('secret')) {
      this.secret = options.secret;

      if (options.hasOwnProperty('algorithm'))
        this.algorithm = options.algorithm || 'aes-256-ctr';
    }

    if (options.hasOwnProperty('pool')) {
      var pool = options.pool;
      if (isFunction(pool.getConnection)) {
        this.usePool = true;
        this.pool = pool;
      } else if (pool === true) {
        this.usePool = true;
      }
    }

    if (options.hasOwnProperty('keepalive')) {
      var keepalive = options.keepalive;
      if (isNumber(keepalive)) {
        heartbeat = keepalive;
      } else if (!keepalive) {
        heartbeat = -1;
      }
    }

    this.config = options.config;

    if (this.usePool && heartbeat > 0) {
      var keepAlive = function keepAlive() {
        this.query(function(connection, done) {
          connection.ping();
          done();
        }, function noop() {});
      }.bind(this);

      setInterval(keepAlive, heartbeat);
    }

    var cleanupQuery = 'DELETE FROM `' + TableName + '` WHERE id IN (' +
      'SELECT temp.id FROM (' +
        'SELECT `id` FROM `' + TableName + '` WHERE `expires` > 0 AND `expires` < UNIX_TIMESTAMP()' +
      ') AS temp' +
    ');'

    var nodeCleanup = function() {
      this.query(function(connection, done) {
        connection.query(cleanupQuery, function(err) {
          done(err);
        });
      }, function noop() {});
    }.bind(this);

    this.query(function(connection, done) {
      connection.query('CREATE TABLE IF NOT EXISTS `' + TableName +
        '` (`sid` VARCHAR(255) NOT NULL, `session` TEXT NOT NULL, `expires` INT, PRIMARY KEY (`sid`) ) CHARACTER SET utf8 COLLATE utf8_unicode_ci',
        function(err) {
          if (err) done(err);
          else if (cleanup) {
            connection.query('SET GLOBAL event_scheduler = 1', function(
              err) {
              if (err) {
                if (err.code !== 'ER_SPECIFIC_ACCESS_DENIED_ERROR')
                  done(err);
                else {
                  setInterval(nodeCleanup, 900000);
                  done();
                }
              } else {
                connection.query(
                  'CREATE EVENT IF NOT EXISTS `sess_cleanup` ON SCHEDULE EVERY 15 MINUTE DO ' +
                  cleanupQuery,
                  function(err) {
                    done(err);
                  });
              }
            });
          } else done();
        });
    }, function(err) {
      if (err) throw err;
    });
  }


  util.inherits(MySQLStore, Store);


  Object.defineProperty(MySQLStore.prototype, 'mysql', {
    get: function() {
      if (this.__mysql) return this.__mysql;
      else {
        var mysql = null;
        try {
          mysql = require('mysql');
          this.__mysql = mysql;
        } catch (err) {
          throw new Error('mysql module is not installed!');
        }

        return mysql;
      }
    }
  });


  Object.defineProperty(MySQLStore.prototype, 'pool', {
    get: function() {
      if (this.__pool) return this.__pool;
      else {
        var pool = this.mysql.createPool(this.config);
        this.__pool = pool;

        return pool;
      }
    },

    set: function(val) {
      this.__pool = val;
    }
  });


  MySQLStore.prototype.query = function(query, callback) {
    var usePool = this.usePool,
      pool = this.pool,
      config = this.config,
      mysql = this.mysql,
      tries = 0,
      maxTries = (this.numRetries || 3) + 1,

      error = function(err) {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
          retry();
        } else callback(err);
      },

      release = function(connection) {
        return function(err, value) {
          connection.removeListener('error', error);
          if (err) callback(err);
          else {
            if (usePool) connection.release();
            else connection.end();
            if (typeof callback === 'function') callback(null, value);
          }
        };
      },

      execute = function(connection) {
        connection.on('error', error);
        try {
          query(connection, release(connection));
        } catch (err) {
          retry();
        }
      },

      retry = function(prevErr) {
        if (tries < maxTries) {
          tries++;
          try {
            if (usePool) {
              pool.getConnection(function(err, connection) {
                if (err) callback(err);
                else execute(connection);
              });
            } else {
              var connection = mysql.createConnection(config);
              connection.connect(function(err) {
                if (err) callback(err);
                else execute(connection);
              });
            }
          } catch (err) {
            retry(err);
          }
        }
        // TODO: Use "prevError" to report an inner error (will require error lib?)
        else callback(new Error("Connection failed too many times in a row"));
      };

    retry();
  };


  MySQLStore.prototype.get = function(sid, callback) {
    var self = this;
    var secret = self.secret;

    this.query(function(connection, done) {
      connection.query('SELECT `session` FROM `' + TableName + '` WHERE `sid` = ?', [sid], function(err, result) {

          if (result && result[0] && result[0].session) {
            try {
              var session = result[0].session;

              if (secret) {
                session = decryptData(session, secret, this.algo);
              }

              session = JSON.parse(session);

              done(null, session);
            } catch (cryptoErr) {
              done(cryptoErr);
            }
          } else {
            done(err);
          }
        });
    }, callback);
  };


  MySQLStore.prototype.set = function(sid, session, callback) {
    var expires = new Date(session.cookie.expires).getTime() / 1000;

    session = JSON.stringify(session);

    if (this.secret) {
      session = encryptData(session, this.secret, this.algorithm);
    }

    this.query(function(connection, done) {
      connection.query('INSERT INTO `' + TableName +
        '` (`sid`, `session`, `expires`) VALUES(?, ?, ?) ON DUPLICATE KEY UPDATE `session` = ?, `expires` = ?', [
          sid, session, expires, session, expires
        ],
        function(err) {
          done(err);
        });
    }, callback);
  };


  MySQLStore.prototype.destroy = function(sid, callback) {
    this.query(function(connection, done) {
      connection.query('DELETE FROM `' + TableName +
        '` WHERE `sid` = ?', [sid],
        function(err) {
          done(err);
        });
    }, callback);
  };


  return MySQLStore;
};
