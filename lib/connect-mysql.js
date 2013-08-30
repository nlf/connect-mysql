/*
 Author: Nathan LaFreniere <nlf@andyet.net>
 Homepage: https://github.com/nlf/connect-mysql
 MySQL Pool support patch: Anton Skshidlevsky <meefik@gmail.com>
 */

module.exports = function (connect) {
    var Store = connect.session.Store;

    function MySQLStore(options) {
        var self = this;
        var cleanup = true;
        Store.call(self, options);
        if (options.hasOwnProperty('cleanup')) cleanup = options.cleanup;
        self.mysql = options.client;
        self.mysql.getConnection(function(err, connection) {
            connection.query('CREATE TABLE IF NOT EXISTS `sessions` (`sid` VARCHAR(255) NOT NULL, `session` TEXT NOT NULL, `expires` INT, PRIMARY KEY (`sid`) )', function (err) {
                if (err) throw err;
                if (cleanup) {
                    connection.query('CREATE EVENT IF NOT EXISTS `sess_cleanup` ON SCHEDULE EVERY 15 MINUTE DO DELETE FROM `sessions` WHERE `expires` < UNIX_TIMESTAMP()');
                    connection.query('SET GLOBAL event_scheduler = 1');
                }
                connection.end();
            });
        });
    }

    MySQLStore.prototype.__proto__ = Store.prototype;

    MySQLStore.prototype.get = function (sid, callback) {
        this.mysql.getConnection(function(err, connection) {
            connection.query('SELECT `session` FROM `sessions` WHERE `sid` = ?', [sid], function (err, result) {
                if (result && result[0] && result[0].session) {
                    callback(null, JSON.parse(result[0].session));
                } else {
                    callback(err);
                }
                connection.end();
            }).on('error', function (err) {
                    callback(err);
                });
        });
    };

    MySQLStore.prototype.set = function (sid, session, callback) {
        var expires = new Date(session.cookie.expires).getTime() / 1000;
        session = JSON.stringify(session);
        this.mysql.getConnection(function(err, connection) {
            connection.query('INSERT INTO `sessions` (`sid`, `session`, `expires`) VALUES(?, ?, ?) ON DUPLICATE KEY UPDATE `session` = ?, `expires` = ?', [sid, session, expires, session, expires], function (err) {
                callback(err);
                connection.end();
            });
        });
    };

    MySQLStore.prototype.destroy = function (sid, callback) {
        this.mysql.getConnection(function(err, connection) {
            connection.query('DELETE FROM `sessions` WHERE `sid` = ?', [sid], function (err) {
                callback(err);
                connection.end();
            });
        });
    };

    return MySQLStore;
};
