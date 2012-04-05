module.exports = function (connect) {
    var Store = connect.session.Store;

    function MySQLStore(options) {
        Store.call(this, options);
        this.mysql = options.client;
        this.mysql.query('CREATE TABLE IF NOT EXISTS `sessions` (`sid` VARCHAR(255) NOT NULL, `session` TEXT NOT NULL, PRIMARY KEY (`sid`) )', function (err) {
            if (err) throw err;
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
        this.mysql.query('INSERT INTO `sessions` (`sid`, `session`) VALUES(?, ?) ON DUPLICATE KEY UPDATE `session` = ?', [sid, JSON.stringify(session), JSON.stringify(session)], function (err, result) {
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
