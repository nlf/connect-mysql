/*
 Author: Nathan LaFreniere <nlf@andyet.net>
 Homepage: https://github.com/nlf/connect-mysql

 MySQL pool support: Anton Skshidlevsky <meefik@gmail.com>
 Homepage: https://github.com/meefik/connect-mysql
 */
var util = require('util');

function isFunction(obj) {
    return Object.prototype.toString.call(obj) == '[object Function]';
}

function isNumber(obj) {
    return Object.prototype.toString.call(obj) == '[object Number]';
}

module.exports = function (connect) {
    var Store = connect.Store || connect.session.Store,
        TableName = 'sessions';

    function MySQLStore(options) {
        var cleanup = true,
            heartbeat = 30000;
        Store.call(this, options);
        if (options.hasOwnProperty('cleanup')) cleanup = options.cleanup;
        if (options.hasOwnProperty('table')) TableName = options.table;
        if (options.hasOwnProperty('secret')) this.crypto = require('crypto'), this.secret = options.secret;
        if (options.hasOwnProperty('algorithm')) this.algorithm = options.algorithm;
        if (options.hasOwnProperty('retries')) this.numRetries = options.retries;
        if (options.hasOwnProperty('pool')) {
            var pool = options.pool;
            if(isFunction(pool.getConnection)) {
                this.usePool = true;
                this.pool = pool;
            }
            else if(pool === true) {
                this.usePool = true;
            }
        }

        if(options.hasOwnProperty('keepalive')) {
            var keepalive = options.keepalive;
            if(isNumber(keepalive))
                heartbeat = keepalive;
            else if(!keepalive)
                heartbeat = -1;
        }
       
        this.config = options.config;

        if(this.usePool && heartbeat > 0) {
            var keepAlive = function keepAlive() {
                this.query(function(connection, done) {
                    connection.ping();
                    done();
                }, function noop() {});
            }.bind(this);

            setInterval(keepAlive, heartbeat);
        }

        var cleanupQuery = 'DELETE FROM `' + TableName + '` WHERE `expires` > 0 and `expires` < UNIX_TIMESTAMP()';
        var nodeCleanup = function() {
            this.query(function(connection, done) {
                connection.query(cleanupQuery, function(err) {
                    done(err);
                });
            }, function noop() { });
        }.bind(this);

        this.query(function(connection, done) {
            connection.query('CREATE TABLE IF NOT EXISTS `' + TableName + '` (`sid` VARCHAR(255) NOT NULL, `session` TEXT NOT NULL, `expires` INT, PRIMARY KEY (`sid`) ) CHARACTER SET utf8 COLLATE utf8_unicode_ci', function (err) {
                if (err) done(err);
                else if (cleanup) {
                    connection.query('SET GLOBAL event_scheduler = 1', function(err) {
                        if (err) {
                            if (err.code !== 'ER_SPECIFIC_ACCESS_DENIED_ERROR') done(err);
                            else {
                                setInterval(nodeCleanup, 900000);
                                done();
                            }
                        } else {
                            connection.query('CREATE EVENT IF NOT EXISTS `sess_cleanup` ON SCHEDULE EVERY 15 MINUTE DO ' + cleanupQuery, function(err) {
                                done(err);
                            });
                        }
                    });
                }
                else done();
            });
        }, function(err) { if(err) throw err; });
    }

    util.inherits(MySQLStore, Store);

    Object.defineProperty(MySQLStore.prototype, 'mysql', {
        get: function() {
            if(this.__mysql) return this.__mysql;
            else {
                var mysql = null;
                try {
                    mysql = require('mysql');
                    this.__mysql = mysql;
                }
                catch(err) {
                    throw new Error('mysql module is not installed!');
                }

                return mysql;
            }
        }
    });

    Object.defineProperty(MySQLStore.prototype, 'pool', {
        get: function() {
            if(this.__pool) return this.__pool;
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
				if(err.code === 'PROTOCOL_CONNECTION_LOST') {
					retry();
				}
				else callback(err);
			},
            release = function(connection) {
                return function(err, value) {
                    connection.removeListener('error', error);
                    if(err) callback(err);
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
                }
                catch(err) {
                    retry();
                }
            },
            retry = function(prevErr) {
                if(tries < maxTries) {
                    tries++;
                    try {
                        if(usePool) {
                            pool.getConnection(function(err, connection) {
                                if(err) callback(err);
                                else execute(connection);
                            });
                        }
                        else {
                            var connection = mysql.createConnection(config);
                            connection.connect(function(err) {
                                if(err) callback(err);
                                else execute(connection);
                            });
                        }
                    }
                    catch(err) {
                        retry(err);
                    }
                }
                //TODO: Use "prevError" to report an inner error (will require error lib?)
                else callback(new Error("Connection failed too many times in a row"));
            };

        retry();
    };

    MySQLStore.prototype.get = function (sid, callback) {
        secret = this.secret, self = this;
        this.query(function(connection, done) {
            connection.query('SELECT `session` FROM `' + TableName + '` WHERE `sid` = ?', [sid], function (err, result) {
                if (result && result[0] && result[0].session) {
                    try {
                        done(null, JSON.parse((secret) ? decryptData.call(self, result[0].session) : result[0].session));
                    }
                    catch(cryptoErr) {
                        done(cryptoErr);
                    }
                } else {
                    done(err);
                }
            });
        }, callback);
    };

    MySQLStore.prototype.set = function (sid, session, callback) {
        var expires = new Date(session.cookie.expires).getTime() / 1000;
        session = JSON.stringify((this.secret) ? encryptData.call(this, JSON.stringify(session), this.secret, this.algorithm) : session);
        this.query(function(connection, done) {
            connection.query('INSERT INTO `' + TableName + '` (`sid`, `session`, `expires`) VALUES(?, ?, ?) ON DUPLICATE KEY UPDATE `session` = ?, `expires` = ?', [sid, session, expires, session, expires], function (err) {
                done(err);
            });
        }, callback);
    };

    MySQLStore.prototype.destroy = function (sid, callback) {
        this.query(function(connection, done) {
            connection.query('DELETE FROM `' + TableName + '` WHERE `sid` = ?', [sid], function (err) {
                done(err);
            });
        }, callback);
    };

    function encryptData(plaintext){
      var pt = encrypt.call(this, this.secret, plaintext, this.algo)
        , hmac = digest.call(this, this.secret, pt);

      return {
        ct: pt,
        mac: hmac
      };
    }

    function decryptData(ciphertext){
      ciphertext = JSON.parse(ciphertext)
      var hmac = digest.call(this, this.secret, ciphertext.ct);

      if (hmac != ciphertext.mac) {
        throw 'Encrypted session was tampered with!';
      }

      return decrypt.call(this, this.secret, ciphertext.ct, this.algo);
    }

    function digest(key, obj) {
      var hmac = this.crypto.createHmac('sha512', key);
      hmac.setEncoding('hex');
      hmac.write(obj);
      hmac.end();
      return hmac.read();
    }

    function encrypt(key, pt, algo) {
      algo = algo || 'aes-256-ctr';
      pt = (Buffer.isBuffer(pt)) ? pt : new Buffer(pt);

      var cipher = this.crypto.createCipher(algo, key), ct = [];
      ct.push(cipher.update(pt, 'buffer', 'hex'));
      ct.push(cipher.final('hex'));

      return ct.join('');
    }

    function decrypt(key, ct, algo) {
      algo = algo || 'aes-256-ctr';
      var cipher = this.crypto.createDecipher(algo, key), pt = [];

      pt.push(cipher.update(ct, 'hex', 'utf8'));
      pt.push(cipher.final('utf8'));

      return pt.join('');
    }

    return MySQLStore;
};
