module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
  // This config includes all the web service applications used by the fronedend.
  apps : [

    // Web API server
    {
      name      : "webAPI",
      script    : "../web_api/app.js",
	  instances : 2,
      exec_mode : "cluster", 
      env_production : {
        NODE_ENV: "production"
      }
    },

    // ZeroMQ server
    {
      name      : "zmqServer",
      script    : "../zmq_server/start_zmq_server.js",
	  env_production : {
        NODE_ENV: "production"
      }
    }
  ],

  /**
   * Deployment section, may be used in the future
   * http://pm2.keymetrics.io/docs/usage/deployment/
   */
  deploy : {
    production : {
      user : "node",
      host : "212.83.163.1",
      ref  : "origin/master",
      repo : "git@github.com:repo.git",
      path : "/var/www/production",
      "post-deploy" : "npm install && pm2 reload ecosystem.config.js --env production"
    },
    dev : {
      user : "node",
      host : "212.83.163.1",
      ref  : "origin/master",
      repo : "git@github.com:repo.git",
      path : "/var/www/development",
      "post-deploy" : "npm install && pm2 reload ecosystem.config.js --env dev",
      env  : {
        NODE_ENV: "dev"
      }
    }
  }
};
