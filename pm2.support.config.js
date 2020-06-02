module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
   // This config includes the web service applications for processing data (like, simulator, aggregator, datachekcer) 
   // and other support or research applciations (like, Device Info CMS, TCP server)
  apps : [
    // Device Info CMS
    {
      name      : "deviceInfoCMS",
      script    : "../device_info_cms/deviceInfoCMS.js",
	  env_production : {
        NODE_ENV: "production"
      }
    },
	// TCP Server
	{
      name      : "tcpServer",
      script    : "../tcp_server/server/server.js",
	  env_production : {
        NODE_ENV: "production"
      }
    },
    // TCP Client Simulator 
	{
      name      : "tcpClientSimulator",
      script    : "../tcp_server/client_simulator/client_simulator.js",
	  env_production : {
        NODE_ENV: "production"
      }
    },
    //APE data Simulator 
	{
    name      : "apeDataSimulator",
    script    : "../web_api/apeGatewayRecordsSimulator/apeDataSimulator.js",
    env_production : {
      NODE_ENV: "production"
    }
  },
	// Rssi Aggregator
	{
      name      : "rssiAggregator",
      script    : "../lora_rssi_aggregator/startLoRaRssiAggregator.js",
	  env_production : {
        NODE_ENV: "production"
      }
    },
	// data quality checker
	{
    name      : "dataQualityChecker",
    script    : "../data_quality_checker/startDataQualityChecker.js",
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
