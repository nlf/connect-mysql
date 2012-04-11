module.exports = function (connect) {
    var Store = connect.session.Store;

    function MySQLStore(options) {
        var self = this;
        Store.call(self, options);
        self.mysql = options.client;
        self.mysql.query('CREATE TABLE IF NOT EXISTS `sessions` (`sid` VARCHAR(255) NOT NULL, `session` TEXT NOT NULL, `expires` INT, PRIMARY KEY (`sid`) )', function (err) {
            if (err) throw err;
            self.mysql.query('CREATE EVENT `sess_cleanup` ON SCHEDULE EVERY 1 HOUR DO DELETE FROM `sessions` WHERE `expires` < UNIX_TIMESTAMP()');
        });
    }

    MySQLStore.prototype.__proto__ = Store.prototype;

    MySQLStore.prototype.get = function (sid, callback) {
        try {
            this.mysql.query('SELECT `session` FROM `sessions` WHERE `sid` = ?', [sid], function (err, result) {
                if (result && result[0] && result[0].session) {
                    callback(null, JSON.parse(result[0].session));
                } else {
                    return callback();
                }
            });
        } catch (err) {
            callback(err);
        }
    };

    MySQLStore.prototype.set = function (sid, session, callback) {
        var expires = null;
        if (typeof session.cookie.maxAge == 'number') expires = session.cookie.maxAge; 
        this.mysql.query('INSERT INTO `sessions` (`sid`, `session`, `expires`) VALUES(?, ?, ?) ON DUPLICATE KEY UPDATE `session` = ?, `expires` = ?', [sid, JSON.stringify(session), expires, JSON.stringify(session), expires], function (err, result) {
            callback(err);
        });
    };

    MySQLStore.prototype.destroy = function (sid, callback) {
        this.mysql.query('DELETE FROM `sessions` WHERE `sid` = ?', [sid], function (err, result) {
            callback(err);
        });
    };

    return MySQLStore;
};
