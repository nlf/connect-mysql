/*
 Author: Nathan LaFreniere <nlf@andyet.net>
 Homepage: https://github.com/nlf/connect-mysql
 
 MySQL pool support: Anton Skshidlevsky <meefik@gmail.com>
 Homepage: https://github.com/meefik/connect-mysql
 */

module.exports = function (connect) {
    var Store = connect.session.Store;

    function MySQLStore(options) {
        var cleanup = true;
        Store.call(this, options);
        if (options.hasOwnProperty('cleanup')) cleanup = options.cleanup;

        var query = function(connection, pool) {
            connection.query('CREATE TABLE IF NOT EXISTS `sessions` (`sid` VARCHAR(255) NOT NULL, `session` TEXT NOT NULL, `expires` INT, PRIMARY KEY (`sid`) )', function (err) {
                if (err) throw err;
                if (cleanup) {
                    connection.query('CREATE EVENT IF NOT EXISTS `sess_cleanup` ON SCHEDULE EVERY 15 MINUTE DO DELETE FROM `sessions` WHERE `expires` < UNIX_TIMESTAMP()');
                    connection.query('SET GLOBAL event_scheduler = 1');
                }
                if (pool) connection.end();
            });
        }

        this.pool = options.client.config.connectionConfig ? true : false;
        this.mysql = options.client;

        if (this.pool) {
            this.mysql.getConnection(function(err, connection) {
                if (err) throw err;
                query(connection, true);
            });
        } else {
            query(this.mysql, false);
        }
    }

    MySQLStore.prototype.__proto__ = Store.prototype;

    MySQLStore.prototype.get = function (sid, callback) {
        var query = function(connection, pool) {
            connection.query('SELECT `session` FROM `sessions` WHERE `sid` = ?', [sid], function (err, result) {
                if (result && result[0] && result[0].session) {
                    callback(null, JSON.parse(result[0].session));
                } else {
                    callback(err);
                }
                if (pool) connection.end();
            }).on('error', function (err) {
                    callback(err);
                });
        }
        if (this.pool) {
            this.mysql.getConnection(function(err, connection) {
                if (err) callback(err);
                else query(connection, true);
            });
        } else {
            query(this.mysql, false);
        }
    };

    MySQLStore.prototype.set = function (sid, session, callback) {
        var expires = new Date(session.cookie.expires).getTime() / 1000;
        session = JSON.stringify(session);
        var query = function(connection, pool) {
            connection.query('INSERT INTO `sessions` (`sid`, `session`, `expires`) VALUES(?, ?, ?) ON DUPLICATE KEY UPDATE `session` = ?, `expires` = ?', [sid, session, expires, session, expires], function (err) {
                callback(err);
                if (pool) connection.end();
            });
        }
        if (this.pool) {
            this.mysql.getConnection(function(err, connection) {
                if (err) callback(err);
                else query(connection, true);
            });
        } else {
            query(this.mysql, false);
        }
    };

    MySQLStore.prototype.destroy = function (sid, callback) {
        var query = function(connection, pool) {
            connection.query('DELETE FROM `sessions` WHERE `sid` = ?', [sid], function (err) {
                callback(err);
                if (pool) connection.end();
            });
        }
        if (this.pool) {
            this.mysql.getConnection(function(err, connection) {
                if (err) callback(err);
                else query(connection, true);
            });
        } else {
            query(this.mysql, false);
        }
    };

    return MySQLStore;
};
