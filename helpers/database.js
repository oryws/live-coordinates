const r = require('rethinkdb');

const dbHandler = {
  /*
   * Ensures we have a database
   */
  createDatabase: (conn) => {
    const dbName = process.env.DBNAME;
    return new Promise((resolve, reject) => {
      console.log(`Checking for database ${dbName}`);
      r.dbList().contains(dbName).run(conn).then(dbExists => {
        if(dbExists) {
          console.log(`Database ${dbName} already there, so don't worry mate`);
          resolve(conn);
        } else {
          console.log(`No database, creating...`);
          r.dbCreate(dbName).run(conn).then(() => {
            console.log(`Database created mate, have a nice day`);
            resolve(conn);
          }).catch(ex => reject(ex));
        }
      }).catch(ex => reject(ex));
    });
  }
}

module.exports = dbHandler;