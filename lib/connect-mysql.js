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

module.exports = function (connect) {
    var Store = connect.session.Store,
        TableName = 'sessions';

    function MySQLStore(options) {
        var cleanup = true;
        Store.call(this, options);
        if (options.hasOwnProperty('cleanup')) cleanup = options.cleanup;
        if (options.hasOwnProperty('table')) TableName = options.table;
        if(options.hasOwnProperty('pool')) {
            var pool = options.pool;
            if(isFunction(pool.getConnection)) {
                this.usePool = true;
                this.pool = pool;
            }
            else if(pool === true) {
                this.usePool = true;
            }
        }
       
        this.config = options.config;

        var cleanupQuery = 'DELETE FROM `' + TableName + '` WHERE `expires` < UNIX_TIMESTAMP()';
        var nodeCleanup = function() {
            this.query(function(connection, release) {
                connection.query(cleanupQuery);
                release(connection);
            });
        }.bind(this);

        this.query(function(connection, release) {
            connection.query('CREATE TABLE IF NOT EXISTS `' + TableName + '` (`sid` VARCHAR(255) NOT NULL, `session` TEXT NOT NULL, `expires` INT, PRIMARY KEY (`sid`) ) CHARACTER SET utf8 COLLATE utf8_unicode_ci', function (err) {
                if (err) throw err;
                if (cleanup) {
                    connection.query('SET GLOBAL event_scheduler = 1', function(err) {
                        if (err) {
                            if (err.code !== 'ER_SPECIFIC_ACCESS_DENIED_ERROR') throw err;
                            setInterval(nodeCleanup, 900000);
                            release(connection);
                        } else {
                            connection.query('CREATE EVENT IF NOT EXISTS `sess_cleanup` ON SCHEDULE EVERY 15 MINUTE DO ' + cleanupQuery, function(err) {
                                release(connection);
                            });
                        }
                    });
                } else {
                    release(connection);
                }
            });
        });
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

    MySQLStore.prototype.query = function(query) {
        var usePool = this.usePool,
            release = function(connection) {
                if (usePool) connection.release();
                else connection.end();
            };

        if(usePool) {
            this.pool.getConnection(function(err, connection) {
                if (err) throw err;
                query(connection, release);
            });
        }
        else {
            var conn = this.mysql.createConnection(this.config);
            query(conn, release);
        }
    };

    MySQLStore.prototype.get = function (sid, callback) {
        this.query(function(connection, release) {
            connection.query('SELECT `session` FROM `' + TableName + '` WHERE `sid` = ?', [sid], function (err, result) {
                if (result && result[0] && result[0].session) {
                    callback(null, JSON.parse(result[0].session));
                } else {
                    callback(err);
                }
                release(connection);
            }).on('error', function (err) {
                callback(err);
            });
        });
    };

    MySQLStore.prototype.set = function (sid, session, callback) {
        var expires = new Date(session.cookie.expires).getTime() / 1000;
        session = JSON.stringify(session);
        this.query(function(connection, release) {
            connection.query('INSERT INTO `' + TableName + '` (`sid`, `session`, `expires`) VALUES(?, ?, ?) ON DUPLICATE KEY UPDATE `session` = ?, `expires` = ?', [sid, session, expires, session, expires], function (err) {
                callback(err);
                release(connection);
            });
        });
    };

    MySQLStore.prototype.destroy = function (sid, callback) {
        this.query(function(connection, release) {
            connection.query('DELETE FROM `' + TableName + '` WHERE `sid` = ?', [sid], function (err) {
                callback(err);
                release(connection);
            });
        });
    };

    return MySQLStore;
};
