/*
 Author: Nathan LaFreniere <nlf@andyet.net>
 Homepage: https://github.com/nlf/connect-mysql
 
 MySQL pool support: Anton Skshidlevsky <meefik@gmail.com>
 Homepage: https://github.com/meefik/connect-mysql
 */

module.exports = function (connect) {
    var Store = connect.session.Store
      , TableName = 'sessions';

    function MySQLStore(options) {
        var cleanup = true;
        Store.call(this, options);
        if (options.hasOwnProperty('cleanup')) cleanup = options.cleanup;
        if (options.hasOwnProperty('table')) TableName = options.table;

        this.pool = options.client.config.connectionConfig ? true : false;
        this.mysql = options.client;

        this.query(function(connection, release) {
            connection.query('CREATE TABLE IF NOT EXISTS `' + TableName + '` (`sid` VARCHAR(255) NOT NULL, `session` TEXT NOT NULL, `expires` INT, PRIMARY KEY (`sid`) ) CHARACTER SET utf8 COLLATE utf8_unicode_ci', function (err) {
                if (err) throw err;
                if (cleanup) {
                    connection.query('CREATE EVENT IF NOT EXISTS `sess_cleanup` ON SCHEDULE EVERY 15 MINUTE DO DELETE FROM `' + TableName + '` WHERE `expires` < UNIX_TIMESTAMP()');
                    connection.query('SET GLOBAL event_scheduler = 1');
                }
                release();
            });
        });
    }

    MySQLStore.prototype.__proto__ = Store.prototype;

    MySQLStore.prototype.query = function(query) {
        var pool = this.pool;
        var release = function() {
            if (pool) connection.release();
        }
        if (pool) {
            this.mysql.getConnection(function(err, connection) {
                if (err) throw err;
                query(connection, release);
            });
        } else {
            query(this.mysql, release);
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
                release();
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
                release();
            });
        });
    };

    MySQLStore.prototype.destroy = function (sid, callback) {
        this.query(function(connection, release) {
            connection.query('DELETE FROM `' + TableName + '` WHERE `sid` = ?', [sid], function (err) {
                callback(err);
                release();
            });
        });
    };

    return MySQLStore;
};
