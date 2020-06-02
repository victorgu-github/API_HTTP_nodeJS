# Web API Server
<br>

# Description:

The web API is the main layer between  databases and our various frontend applications. It accepts various HTTP requests and returns JSON objects containing data from our databases. The full list of all web services offered and example inputs can be viewed here:

* Test API Index page: [http://10.10.10.7:8100/](http://10.10.10.7:8100/)
* Prod API Index page: [http://207.34.103.154:8000/](http://207.34.103.154:8000/)

# Setup:

To install and run the web API on a new machine for the first time, see the [nodejs_doc technical release steps document](http://10.10.10.6:7990/projects/MAI/repos/nodejs_doc/browse/Nodejs/WebAPI).
<br>
<br>

# Dependencies:

* Mongo DB

# Environments:

The web API is split into separate environments. For more information please check the "Readme.md" file located inside the "nodejs_doc" repo.

<br>
<br>

# Database Collection Configuration

Web API's various data is split across four database servers:

### agtsDbServer:

* regional_band_map
* regional_class_map
* device_info
* activenodes
* objects
* ape_record
* app_multicast_session
* app_rssi_history
* gatewayrecords
* gw_multicast_session
* lora_gw_hardware_setting
* app_node_session
* gw_node_session
* app_rssi_history

### nodejsDbServer:

* device_maintenance_history
* built_in_plug_data
* externPlugCN470Data
* electricity_consumption
* body_sensor
* smart_switch_data
* smoke_detector_data
* unspecified_device_data
* adminUserAccounts
* companyInfo
* generalUserAccounts
* generalUserApplications
* userinfo
* operationHistory
* geo_data
* lora_dyn_agg_info

### bleConfigDbServer:

* agts_ble_app
* agts_ble_gw
* agts_ble_node

### bleDataDbServer:

* agts_ble_node_activity

<br>
<br>

# Database Naming Convention:
``` JSON
| Database              | Name                     | Variable Format                    |
|-----------------------|--------------------------|------------------------------------|
| APE Records           | data_loc_<SCENARIO_ID>*  | Integer, n != 0                    |
| Gateway Server DBs    | agts_lora_gw             | ---                                |
| App Server DBs        | agts_lora_app_<APP_ID>*  | 64-bit value in hexadecimal form   |
| User Accounts         | useraccounts             | ---                                |
| TCP Geo Data          | tcp_geo_data             | ---                                |
```
Where "SCENARIO_ID" is any integer greater than 0, and "APP_ID" is any valid 64-bit value in hexadecimal form (e.g.: 0000000000000001)
<br>
<br>

# Simulators:

The following standalone data simulators run in Calgary Test and Calgary Prod environments. They insert records into the various databases at the following rates:

``` JSON
|                   | Test                 | Prod                  |
|-------------------|----------------------|-----------------------|
| APE Records       | 600 records / min    | 600 records / min     |
| Gateway Records   | 120 records / min    | 120 records / min     |
| TCP Geo Data      | 7,200 records / min  | 7,200 records / min   |
```
<br>
<br>

# Data Cleanup Frequency:

All real and simulated data are removed periodically during the day, at the following intervals:
``` JSON
|                           | Calgary Test      | Calgary Prod          |
|---------------------------|-------------------|-----------------------|
| Real APE Records          | ---               | Every 2 hours         |
| Simulated APE Records     | Every 12 hours    | Every 12 hours        |
| Simulated Gateway Records | Every 24 hours    | Every 24 hours        |
| Simulated TCP Geo Data    | Every 2 hours     | Every 2 hours         |
```
<br>
<br>


<br>

# ESLint:

The Web API repo has an ESLint installation which can be run by opening up a terminal window at the repo directory, and executing the following command:

```./node_modules/.bin/eslint .```

Notice the period (".") at the end.

# Known Issues:
* 2018-01-23MDT - Changed web api http to use port 8100 in shanghai prod because machine 94 cannot honor any request at port 8000 (don't know why yet). 
* 2017-09-08T22:41:22MDT - The "passport-jwt" package has a maximum supported version of 2.0.0 in order for Web API to be run on 10.10.10.9, as defined in the package.json (passport and passport-jwt are not used for now)
* 2017-08-03T14:58:27MDT - All web services are guaranteed for this commit, and the previous known issue below has been deemed resolved (i.e.: device control is now supported).
* 2017-07-25T09:45:38MDT - **IMPORTANT:** The latest commit in the master branch of the web API has put it in a partially-stable state. This is intentional, as we are doing a major change in sections, and testing each section one at a time in the Staging environment. Right now, the only LoRa web services that are certified operational and ready for testing are device registration-related web services (i.e.: device control is not supported yet).
<br>
<br>

# Miscellaneous Notes:
* 2018-02-26T11:07MST - Turning off all data simulators in Shanghai Prod for performance reasons
* 2017-11-23T09:56MST - Set up cleanup scripts for Shanghai Prod
* 2017-09-11T21:33:09MDT - Changed "removeRealApeRecords.sh" cleanup script call frequency from every 12 hours to every 2 hours
* 2017-09-08T22:44:05MDT - Started up Test Web API in new location on 10.10.10.9 (previously installed on 10.10.10.7)
* 2017-07-25T21:40MDT - Changed all "HasUnencrytpedMacCmdDelivered" typos to "HasUnencryptedMacCmdDelivered". This will break the frontend applications that depend on the former field name, and a global search + replace must be done.
* 2017-06-26T10:24MDT - Added "3136470A1B001F00" and "3136470825004100" to the Prod config/devicesConfig.js file. This was a one-off modification as Ron needs to test two new streetlights and the production server is still using the old logic for listing streetlight DevEUIs.
* 2017-07-05 6:07pm - New special case routing for Shanghai Mongo server, separate routing for LoRa device registration and device control, and removed references to deprecated test suite.
