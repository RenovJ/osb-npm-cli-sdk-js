const OASISBlocAPI = require('osb-cli-sdk')
const config = require('./config/dev.conf')
const fs = require('fs');

const c = {
  chainAccessPoint: `${config.CHAIN_PROTOCOL}://${config.CHAIN_IPADDR}:${config.CHAIN_PORT}`,
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
const datatypename = 'mobility'
const price = '0.0002'
const detailFields = [
                      'Audi',
                      'A6',
                      '2014',
                      '2019-10-15 09:00 ~',
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

osb.setEventCallback(console.log)

//osb.registerData(dataBuffer, datatypename, detailFields, price, period, decryptKeyList)

const buyerPrivateKey = config.BUYER_PRIVATE_KEY
const data_id = 96

//osb.setAuthForContract()
//const returnedData = osb.buyData(data_id, buyerPrivateKey)
osb.test(dataBuffer, data_id, buyerPrivateKey)

