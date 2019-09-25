const OASISBlocAPI = require('oasisbloc_cli_sdk')
const config = require('./config/dev.conf')
const fs = require('fs');

const c = {
  protocol: config.CHAIN_PROTOCOL,
  ipAddress: config.CHAIN_IPADDR,
  port: config.CHAIN_PORT,
  chainId: config.CHAIN_ID,
  dataTradeContractName: config.DATA_TRADE_CONTRACT_NAME,
  privateKey: config.ACCOUNT_PRIVATE_KEY,
  account: config.ACCOUNT
}
var osb = new OASISBlocAPI(c)

const textData = 'abcd'
const fileDataPath = '/home/changhee/OASISBloc/testdata'
//const dataBuffer = Buffer.from(textData)
const dataBuffer = fs.readFileSync(fileDataPath)
const datatype = 'text'
const datatypename = 'type1'
const price = '99.0000'
const detailFields = [
                      'abcd',
                      'data2',
                      'data3',
                      'data4',
                      'data5',
                      'data6',
                      'data7',
                      'data8',
                      'data9',
                      'data0',
                      ]
const period = 2
const decryptKeyList = [
                        '5J3r5BNGQeefTiXokHX88J9FYtRFVXzLPw89fWTyXj7TvRmpaCk',
                        '5JwjE3Vfhmsm2iZYWkthMbSryGUALSw1TphUxm3DLsThdregRku',
                        //'5JDAFQiZs5hULAqPzosqwTtzDKuyUAomKg9u9E9XaJyzMfFExRF',
                        //'5KU8Ypv4WXbRNEsmmfqqEW93Q59EYr6T1rSkvECVAc3VL91wBbH',
                        //'5KhcrMCCo4KNUN9VZ85jy8AJxoqHErr56UsNGwfRWjvq1dnYczy',
                        //'5JY2y1TvVXyNKSw4SswzUwuDSGUUKNHVhPr1JkP2eBQHhbSV5rs',
                        //'5KAV6zT5P8wotJyaPsjePub8NzE6w1ModGR7dKDTHRbXYL6QHNn',
                        //'5J7YRw9Fxq6vaTmrhicDBZBtYpmsJYuPb5UFLaZ2m2GhBkDDW8d',
                        ]
osb.registerData(dataBuffer, datatype, datatypename, price, detailFields, period, decryptKeyList)

const buyerPrivateKey = config.BUYER_PRIVATE_KEY
const data_id = 1

//osb.setAuthForContract()
//const returnedData = osb.buyData(data_id, buyerPrivateKey)
//osb.test(dataBuffer, data_id, buyerPrivateKey)

