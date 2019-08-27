//const cors = require('cors');
const Buffer = require('buffer').Buffer
//const axios = require('axios')

const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');      // development only
const fetch = require('node-fetch');                                    // node only; not needed in browsers
const { TextEncoder, TextDecoder } = require('text-encoding');          // React Native, IE11, and Edge Browsers only

const Eosjs = require('eosjs')
const EosjsApi = require('eosjs-api')
const EosjsEcc = require('eosjs-ecc')
const crypto = require('crypto')
const eccrypto = require('eccrypto')
const bs58 = require('bs58')
const bitwise = require('bitwise')
const axios = require('axios')

const http = require('http');
const fs = require('fs');

const DATA_STATUS_AVAILABLE = 0
const SECP256K1_TYPE = 714
const PUBKEY_PREFIX = 'EOS' 

var OASISBlocAPI = class {
	constructor (config) {
		this.osb = {
			protocol: config.protocol,
			ipAddress: config.ipAddress,
			port: config.port,
			chainId: config.chainId,
			dataTradeContractName: config.dataTradeContractName,
			privateKey: config.privateKey,
			account: config.account
		}
		
		const signatureProvider = new JsSignatureProvider([this.osb.privateKey]);
		const rpc = new JsonRpc(`${this.osb.protocol}://${this.osb.ipAddress}:${this.osb.port}`,
			{ fetch });
		this.eosjs = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() })
		this.allowedNumberOfFragment = [ 1, 2, 4, 8 ]
		
		const config_eosjs_api = {
			  httpEndpoint: `${config.protocol}://${config.ipAddress}:${config.port}`, // default, null for cold-storage
			  verbose: true, // API logging
			  logger: { // Default logging functions
			    log: config.verbose ? console.log : null,
			    error: config.verbose ? console.error : null
			  },
			  fetchConfiguration: {}
			}
		this.eosjsapi = EosjsApi(config_eosjs_api)
	}
	
	async sleep(seconds) {
		console.log('sleeping for 2 sec...')
		return new Promise(r => setTimeout(r(), seconds))
	}
	
	async adddatabegin(data, datatype, datatypename, price, detailFields, period, decryptKeyList) {
		console.log('adddatabegin()')
		
		const dataSize = data.length
		
		// validating the parameters
		if (!Buffer.isBuffer(data)) {
			console.log('error! - data must be a type of Buffer')
			return
		}
		
		if (!this.allowedNumberOfFragment.includes(decryptKeyList.length)) {
			console.log('error! - decryptKeyList.length must be 1, 2, 4 or 8 ')
			return
		}
		
		console.log('Validating input is done')
		
		const numberOfFragment = decryptKeyList.length
		
		// getting the original hash
		const originalDataHash = this.getDataHash(data)
		console.log('Getting the original data hash: ' + originalDataHash)
		
		// fragmentation
		const frag = this.fragmentize(data, numberOfFragment)
		
		// getting the hashes from original fragments
		var fragmentHashOriginal = []
		for (var i=0; i < numberOfFragment; i++) {
			fragmentHashOriginal[i] = this.getDataHash(frag[i])
		}
		
		console.log('Fragmentation is done')
	
		// encrypting fragments
		var encryptedFrag = []
		var encryptKeyList = []
		for (var i=0; i < numberOfFragment; i++) {
			encryptKeyList.push( EosjsEcc.privateToPublic(decryptKeyList[i], PUBKEY_PREFIX) )
			encryptedFrag[i] = await this.encode(frag[i], encryptKeyList[i])
			encryptedFrag[i].isDataEncrypted = true
			
			console.log(decryptKeyList[i] + ' - ' + EosjsEcc.privateToPublic(decryptKeyList[i], PUBKEY_PREFIX))
		}
		
		console.log('Encrypting fragments is done')
		
		// getting the hashes from encrypted fragments
		var fragmentHashEncrypted = []
		for (var i=0; i < numberOfFragment; i++) {
			fragmentHashEncrypted[i] = this.getDataHash(encryptedFrag[i])
		}
		
		console.log('Getting hashes of encrypted fragments is done')
		
		// registering data by pushing the action 'addDataBegin' to mainnet
		var fragments = []
		for (var i=0; i < numberOfFragment; i++) {
			fragments[i] = {
				fragment_no: i+1,
				size: encryptedFrag[i].length,
				hash_original: fragmentHashOriginal[i],
				hash_encrypted: fragmentHashEncrypted[i],
				cid: '',
				idfs_cluster_id: 0,
				encrypt_key: encryptKeyList[i]
			}
		}
		console.log('fragments:')
		console.log(fragments)

		const result = await this.eosjs.transact({
			actions: [{
		      account: this.osb.dataTradeContractName,
		      name: 'adddatabegin',
		      authorization: [{
		        actor: this.osb.account,
		        permission: 'active',
		      }],
		      data: {
		    	provider: this.osb.account,				//데이터 제공자 계정명
	    	    datatype_name: datatypename,			//데이터 타입명
	    	    price: String(price),					//데이터 구매 가격 (단위: 0.0001 OSB)
	    	    detail_fields: detailFields,			//데이터 추가 필드 값
	    	    period: period,							//데이터 보관 기간 (단위: 일)
	    	    data_hash_original: originalDataHash,	//원본 데이터 해시 값 (해싱 알고리즘: SHA256)
	    	    size: dataSize,							//원본 데이터 사이즈 (단위: byte)
	    	    fragments: fragments,					//데이터 조각
		      },
		    }]
		}, {
		  blocksBehind: 3,
		  expireSeconds: 30,
		}).catch(function (error) {
			console.log(error)
			console.log(error.json.error.details)
			return
		})
		
		console.log('Pushing an action of adddatabegin()')
		console.log({
	    	provider: this.osb.account,				//데이터 제공자 계정명
    	    datatype_name: datatypename,			//데이터 타입명
    	    price: String(price),					//데이터 구매 가격 (단위: 0.0001 OSB)
    	    detail_fields: detailFields,			//데이터 추가 필드 값
    	    period: period,							//데이터 보관 기간 (단위: 일)
    	    data_hash_original: originalDataHash,	//원본 데이터 해시 값 (해싱 알고리즘: SHA256)
    	    size: dataSize,							//원본 데이터 사이즈 (단위: byte)
    	    fragments: fragments,					//데이터 조각
	      })
	    console.log('adddatabegin() result: ')
		console.log(result)
	    console.log({
	        json: true,
	        code: this.osb.dataTradeContractName,
	        scope: this.osb.dataTradeContractName,
	        table: "data",
	    })
	    
	    return {
			originalDataHash: originalDataHash,
			encryptedFrag: encryptedFrag,
			fragments: fragments,
			encryptKeyList: encryptKeyList,
		}
	}
	
	async checkIfFinishToAddDataBegin(originalDataHash) {
		console.log('checkIfFinishToAddDataBegin()')
		
		//while (true) {
			//await this.sleep(1000)
			//const result = await this.sleep(2000)
			//console.log(result)
			
			// retrieving idfs clusters and their idfs node information for each fragment
			const dataList = await this.eosjsapi.getTableRows({
		        json: true,
		        code: this.osb.dataTradeContractName,
		        scope: this.osb.dataTradeContractName,
		        table: "data",
		        table_key: "data_id",
		        limit: 5,
		        reverse: true
		    }).catch(function(error) {
		        console.log(error)
		        reject('failed to retrieve data list')
		    });
			
			console.log('Getting table rows of dataList is done')
			
			var dataRow = false
			for (var i=0; i < dataList.rows.length; i++) {
				console.log(originalDataHash + ' - ' + dataList.rows[i].data_hash_original)
				if (dataList.rows[i].data_hash_original === originalDataHash) {
					dataRow = dataList.rows[i]
					
					console.log(dataRow)
					const result = {
						dataRow: dataRow
					}
					return result
				}
			}
		//}
	}
	
	async uploadData(
			providerAccount,
			dataTradeContractAccount,
			dataId,
			datatype,
			encryptedFrag,
			fragments,
			encryptKeyList,
			decryptKeyList) {
		console.log('uploadData()')
		
		// Making a list of idfsList
		var idfsList = []
		for (var f=0; f < fragments.length; f++) {
			idfsList[f] = await this.getIdfsList(fragments[f].idfs_cluster_id)
		}
		console.log('idfsList:')
		console.log(idfsList)
		
		// uploading each fragment to IDFS node, and received CIDs
		for (var c=0; c < idfsList.length; c++) {
			console.log('uploading fragment no: ' + (c+1))
			
			const ret = await this.uploadDataToIdfs(idfsList[c][0], {
				provider_account: providerAccount,
				contract_addr: dataTradeContractAccount,
				reserved_data_id: dataId,
				fragment_no: c + 1,
				decrypt_key: decryptKeyList[c],
				data_type: datatype,
				data: encryptedFrag[c],
				is_data_encrypted: encryptedFrag[c].isDataEncrypted
			}).catch(function (err) {
				console.log(err)
				return
			})
			
			console.log("response from idfs for uploading data")
			console.log(ret)

			// register cid to fragments
			fragments[c].fragment_no = c + 1
			fragments[c].cid = ret.cid
			fragments[c].encrypt_key = encryptKeyList[c]
			
			// uploading decrypt-keys of fragments to IDFS in each cluster
			for (var i=1; i < idfsList[c].length; i++) {
				// encrypting decrypt-keys for each IDFS provider
				console.log({
					provider_account: providerAccount,
					contract_addr: dataTradeContractAccount,
					reserved_data_id: dataId,
					fragment_no: c + 1,
					decrypt_key: decryptKeyList[c],
					cid: fragments[c].cid
				})
				this.uploadDecryptKeyToIdfs(idfsList[c][i], {
					provider_account: providerAccount,
					contract_addr: dataTradeContractAccount,
					reserved_data_id: dataId,
					fragment_no: c + 1,
					decrypt_key: decryptKeyList[c],
					cid: fragments[c].cid
				})
				.then(function (ret) {
					console.log(`Uploading decrypt key of fragment(${fragment_no}) for IDFS provider(${c}) is done`)
				}).catch(function (err) {
					console.log(err)
					return
				})
			}
		}
		console.log(fragments)
		return {
			fragments: fragments
		}
	}
	
	async addDataEnd(fragments, dataId) {
		console.log('Pushing an action addDataEnd()')
		console.log(JSON.stringify({
			actions: [{
		      account: this.osb.dataTradeContractName,
		      name: 'adddataend',
		      authorization: [{
		        actor: this.osb.account,
		        permission: 'active',
		      }],
		      data: {
		    	provider: this.osb.account,				//데이터 제공자 계정명
	    	    data_id: dataId,			//데이터 타입명
	    	    fragments: fragments,					//데이터 조각
		      },
		    }]
		}))
		const result = await this.eosjs.transact({
			actions: [{
		      account: this.osb.dataTradeContractName,
		      name: 'adddataend',
		      authorization: [{
		        actor: this.osb.account,
		        permission: 'active',
		      }],
		      data: {
		    	provider: this.osb.account,				//데이터 제공자 계정명
	    	    data_id: dataId,			//데이터 타입명
	    	    fragments: fragments,					//데이터 조각
		      },
		    }]
		}, {
		  blocksBehind: 3,
		  expireSeconds: 30,
		}).catch(function (error) {
			console.log(error)
			return
		})
	}
	
	/* The type of data is Buffer */
	async registerData(data, datatype, datatypename, price, detailFields, period, decryptKeyList) {
		console.log('registerData()')
		
		const resultAddBegin = await this.adddatabegin(data, datatype, datatypename, price, detailFields, period, decryptKeyList)
	    const resultAfterAddBegin = await this.checkIfFinishToAddDataBegin(resultAddBegin.originalDataHash)
		const resultUpload = await this.uploadData(
				this.osb.account,
				this.osb.dataTradeContractName,
				resultAfterAddBegin.dataRow.data_id,
				datatype,
				resultAddBegin.encryptedFrag,
				resultAfterAddBegin.dataRow.fragments,
				resultAddBegin.encryptKeyList,
				decryptKeyList)
		await this.addDataEnd(resultUpload.fragments, resultAfterAddBegin.dataRow.data_id)
	}
	
	/* The return value is data in Buffer */
	async buyData(dataId, buyerPrivateKey) {
		console.log(`buyData(${dataId}, ${buyerPrivateKey})`)
		// TODO validating of the parameters
		const buyerPublicKey = EosjsEcc.privateToPublic(buyerPrivateKey, PUBKEY_PREFIX) 
		
		// TODO checking if the data id is available to buy
		const dataList = await this.eosjsapi.getTableRows({
	        json: true,
	        code: this.osb.dataTradeContractName,
	        scope: this.osb.dataTradeContractName,
	        table: "data",
	        table_key: "data_id",
	        lower_bound: dataId,
	        upper_bound: dataId + 1,
	        limit: 5,
	        reverse: true
	    }).catch(function(error) {
	        console.log(error)
	        console.log('failed to retrieve data list')
	    });
		
		const dataRow = dataList.rows[0]
		if (dataRow.status !== DATA_STATUS_AVAILABLE) {
			console.log('The data is not available')
			return
		}
		console.log('\ndataRow:')
		console.log(dataRow)
		
		// acquiring an authority to access data to buy by pushing an action 'buyData' to mainnet
		const resultBuy = await this.eosjs.transact({
			actions: [{
		      account: this.osb.dataTradeContractName,
		      name: 'buydata',
		      authorization: [{
		        actor: this.osb.account,
		        permission: 'active',
		      }],
		      data: {
		    	  user: this.osb.account,
		          data_id: dataId,
		          buyer_key: buyerPublicKey
		      },
		    }]
		}, {
		  blocksBehind: 3,
		  expireSeconds: 30,
		}).catch(function (error) {
			console.log(error)
			console.log(error.json.error.details)
//			return // 구매했어도 아래의 상황을 진행할 수 있게 주석처리
		})
		
		// TODO get buy_id from buyhistory by using resultBuy transaction info.
		const buyhistoryList = await this.eosjsapi.getTableRows({
	        json: true,
	        code: this.osb.dataTradeContractName,
	        scope: this.osb.dataTradeContractName,
	        table: "buyhistory",
	        table_key: "buy_id",
	        limit: 5,
	        reverse: true
	    }).catch(function(error) {
	        console.log(error)
	        console.log('failed to retrieve data list')
	    });
		var buyhistory = false
		for (var i=0; i<buyhistoryList.rows.length; i++) {
			if (buyhistoryList.rows[i].buyer === this.osb.account &&
				buyhistoryList.rows[i].data_id === dataId) {
				buyhistory = buyhistoryList.rows[i]
				break
			}
		}
		if (!buyhistory) {
	        console.log('Cannot find the buy history')
			return
		}
		
		var fragments = []
		for (var c = 0; c < dataRow.fragments.length; c++) {
			// retrieving data, idfs clusters and their idfs node information for each fragment
			const idfsList = await this.getIdfsList(dataRow.fragments[c].idfs_cluster_id)
			const idfs = idfsList[0]
			
			console.log(dataRow.fragments[c].cid)
			
			// downloading data fragment
			const resGetData = await axios({
		    	url: 'http://' + idfs.ipaddr + ':' + idfs.port + '/v0/get_data',
		    	method: 'get',
		    	data: {
		    		cid: dataRow.fragments[c].cid
		    	}
		    }).catch( err => { console.log(err); } ); // ERROR
			
			console.log('response for the request to download data fragment')
			console.log(resGetData.data)
			
			var encryptedFragment = await fetch(resGetData.data)
//			console.log(encryptedFragment)
			//encryptedFragment = await encryptedFragment.blob()
			console.log('Fetched Buffer:')
			console.log(encryptedFragment.body._readableState.buffer.head.data)
			
			encryptedFragment = encryptedFragment.body._readableState.buffer.head.data
			
			//const file = fs.createWriteStream("file.jpg");
			/*
			const request = http.get(resGetData.data, function(response) {
				//response.pipe(file);
//				console.log('\nRequest:')
//				console.log(request)
//				console.log('\nResponse:')
//				console.log(response)
			});
			*/
			
			//console.log(encryptedFragment)///////////////////////// TODO implement DOWNLOAD
			
			// requesting and decrypt-key
			const resGetDecryptKey = await axios({
		    	url: 'http://' + idfs.ipaddr + ':' + idfs.port + '/v0/get_decrypt_key',
		    	method: 'get',
		    	data: {
		    		data_id: dataRow.data_id,
		    		fragment_no: dataRow.fragments[c].fragment_no,
		    	    cid: dataRow.fragments[c].cid,
		    	    buy_id: buyhistory.buy_id,
		    	    buyer_account: this.osb.account,
		    	    buyer_key: buyerPublicKey
		    	}
		    }).catch( err => { console.log(err); } ); // ERROR
			
			const encryptedDecryptKeyBuffer = Buffer(resGetDecryptKey.data.decrypt_key)
			console.log('Response to the request to get decrypt key:')
			console.log(encryptedDecryptKeyBuffer)
			
			// decrypting decrypt-keys by using buyerPrivateKey
			const decryptKeyBuffer = await this.decode(encryptedDecryptKeyBuffer, buyerPrivateKey)
			
			console.log('Decrypt Key:')
			console.log(decryptKeyBuffer.toString())
			
			// decrypting data fragments by using decrypt-keys
			fragments.push( await this.decode(encryptedFragment, decryptKeyBuffer.toString()) )
		}

		bitwise.bits.toString(bitwise.buffer.read(fragments[0]), 4, ' ')
		bitwise.bits.toString(bitwise.buffer.read(fragments[1]), 4, ' ')
		
		// merging fragments
		const data = this.merge(fragments, dataRow.size)
		console.log('\nMerged data:')
		console.log(data.toString())
		
		// getting and checking the hash of the merged data
		const mergedDataHash = this.getDataHash(data)
		if (dataRow.data_hash_original !== mergedDataHash) {
			console.log(`Error - the original hash is unmatched to that of the merged data (original hash: ${dataRow.data_hash_original}, merged data hash: ${mergedDataHash})`)
			//return
		}
		
		// returning data
		return data
	}
	
	getDataHash(data) {
		// validating the parameter
		if (!Buffer.isBuffer(data)) {
			console.log('data shoud be Buffer')
			return
		}
		
		const digest = crypto.createHash('sha256').update(data).digest()
		const digestSize = Buffer.from(digest.byteLength.toString(16), 'hex')
		const hashFunction = Buffer.from('12', 'hex') // 0x20
		const combined = Buffer.concat([hashFunction, digestSize, digest])
		const calculatedDataHash = bs58.encode(combined)
		return calculatedDataHash
	}
	
	async getIdfsList(cluster_id) {
		console.log(`\ngetIdfsList(${cluster_id})`)
		
		const idfsList = await this.eosjsapi.getTableRows({
	        json: true,
	        code: this.osb.dataTradeContractName,
	        scope: this.osb.dataTradeContractName,
	        table: "idfs",
	        table_key: "getcluster",
	        lower_bound: cluster_id,
	        upper_bound: cluster_id,
	        key_type: "i64",
	        index_position: 2
	    }).catch(function(error) {
	        console.log(error)
	        res.json({
	            result: false,
	            msg: 'failed to retrieve idfs list'
	        });
	    });
		
		console.log('Idfs list by cluster id')
		console.log(idfsList.rows[0])
		
		var idfsListByClusterId = [];
		for (var i=0; i < idfsList.rows.length; i++) {
			if (idfsList.rows[i].cluster_id === cluster_id) {
				idfsListByClusterId.push(idfsList.rows[i])
			}
		}
		
		return idfsListByClusterId
	}
	
	async uploadDataToIdfs(idfs, data) {
		console.log('uploadDataToIdfs()')
		console.log(idfs)
		console.log(data)
		console.log('uploadDataToIdfs()-----\n')
		
		const encryptedDecryptkeyBuffer = await this.encode(data.decrypt_key, idfs.idfs_public_key)
		
		console.log({
			provider_account: data.provider_account,
	        contract_addr: data.contract_addr,
	        reserved_data_id: data.reserved_data_id,
	        fragment_no: data.fragment_no,
	        decrypt_key: encryptedDecryptkeyBuffer,
	        data_type: data.data_type,
	        data: data.data,
	        is_data_encrypted: data.is_data_encrypted
	    })
	    
	    const response = await axios({
	    	url: 'http://' + idfs.ipaddr + ':' + idfs.port + '/v0/add_data',
	    	method: 'post',
	    	data: {
	    		provider_account: data.provider_account,
		        contract_addr: data.contract_addr,
		        reserved_data_id: data.reserved_data_id,
		        fragment_no: data.fragment_no,
		        decrypt_key: encryptedDecryptkeyBuffer,
		        data_type: data.data_type,
		        data: data.data,
		        is_data_encrypted: data.is_data_encrypted
	    	}
	    }).catch( err => { console.log(err); } ); // ERROR
		
		if (!response.result) {
			console.log(response.msg)
		}
        
    	return new Promise(function(resolve, reject) {
    		const encryptKey = EosjsEcc.privateToPublic(data.decrypt_key, PUBKEY_PREFIX)
    		if (response.data.encrypt_key === encryptKey) {
    			resolve(response.data)
    		} else {
    			reject(`The encrypt key returned from IDFS is unmatched (expected: ${encryptKey}, received: ${response.data.encrypt_key})`)
    		}
    	})
	}
	
	async uploadDecryptKeyToIdfs (idfs, data) {
		console.log('uploadDecryptKeyToIdfs()')
		
		const encryptedDecryptkeyBuffer = await this.encode(data.decrypt_key, idfs.idfs_public_key)
		
		console.log({
	        provider_account: data.provider_account,
	        contract_addr: data.contract_addr,
	        reserved_data_id: data.reserved_data_id,
	        fragment_no: data.fragment_no,
	        decrypt_key: encryptedDecryptkeyBuffer.toString(),
	        cid: data.cid
	    })
	    
	    const response = await axios({
	    	url: 'http://' + idfs.ipaddr + ':' + idfs.port + '/v0/upload_decrypt_key',
	    	method: 'post',
	    	data: {
	    		provider_account: data.provider_account,
		        contract_addr: data.contract_addr,
		        reserved_data_id: data.reserved_data_id,
		        fragment_no: data.fragment_no,
		        decrypt_key: encryptedDecryptkeyBuffer.toString(),
		        cid: data.cid
	    	}
	    }).catch( err => { console.log(err); } ); // ERROR
        
    	return new Promise(function(resolve, reject) {
    		const encryptKey = EosjsEcc.privateToPublic(data.decrypt_key, PUBKEY_PREFIX)
    		if (response.data.encrypt_key === encryptKey) {
    			resolve(response.data)
    		} else {
    			reject(`The encrypt key returned from IDFS is unmatched (expected: ${encryptKey}, received: ${response.data.encrypt_key})`)
    		}
    	})
	}
	
	async setAuthForContract() {
		console.log('setAuthForContract()')
		const auth = {
			threshold: 1,
			keys: [{
				key: EosjsEcc.privateToPublic(this.osb.privateKey, PUBKEY_PREFIX),
				weight: 1
			}],
			accounts: [{
				permission: {
					actor: this.osb.dataTradeContractName,
					permission: "eosio.code"
				},
				weight: 1
			}],
			waits: [{
				wait_sec: 2,
				weight: 1
			}]
		}

		const result = await this.eosjs.transact({
			actions: [{
			    account: 'eosio',
			    name: 'updateauth',
			    authorization: [{
			      actor: this.osb.account,
			      permission: 'active',
			    }],
			    data: {
			    	account: this.osb.account,
				    permission: 'active',
				    parent: 'owner',
				    auth: auth
			    }
			}]
		}, {
		  blocksBehind: 3,
		  expireSeconds: 30,
		}).catch( err => { console.log(err); } ); // ERROR
		
		console.log('result:')
		console.log(result)
		
		return result
	}
	
	async encode(data, encryptKey) {
		const encryptKeyBuffer = bs58.decode(encryptKey.slice(3)).slice(0, 33)
		const opts = await eccrypto.encrypt(encryptKeyBuffer, data)
		
		//assert(opts.iv.length === 16, "Bad IV")
	    //assert(opts.ephemPublicKey.length === 65, "Bad public key")
	    //assert(opts.mac.length === 32, "Bad MAC")
	    // 16 + 2 + 2 + 32 + 2 + 32 + ? + 32
	    var buf = new Buffer(118 + opts.ciphertext.length)
	    opts.iv.copy(buf)
	    buf.writeUInt16BE(SECP256K1_TYPE, 16, true)  // Curve type
	    buf.writeUInt16BE(32, 18, true)  // Rx length
	    opts.ephemPublicKey.copy(buf, 20, 1, 33)  // Rx
	    buf.writeUInt16BE(32, 52, true)  // Ry length
	    opts.ephemPublicKey.copy(buf, 54, 33)  // Ry
	    opts.ciphertext.copy(buf, 86)
	    opts.mac.copy(buf, 86 + opts.ciphertext.length)
	    
	    console.log('\nencode()')
	    console.log(data)
	    console.log(buf)
	    return buf
	}
	
	async decode (buf, decryptKey) {
		//assert(buf.length >= 118, "Buffer is too small")
	    //assert(buf.readUInt16BE(16, true) === SECP256K1_TYPE, "Bad curve type")
	    //assert(buf.readUInt16BE(18, true) === 32, "Bad Rx length")
	    //assert(buf.readUInt16BE(52, true) === 32, "Bad Ry length")
	    var iv = new Buffer(16)
	    buf.copy(iv, 0, 0, 16)
	    var ephemPublicKey = new Buffer(65)
	    ephemPublicKey[0] = 0x04
	    buf.copy(ephemPublicKey, 1, 20, 52)
	    buf.copy(ephemPublicKey, 33, 54, 86)
	    // NOTE(Kagami): We do copy instead of slice to protect against
	    // possible source buffer modification by user.
	    var ciphertext = new Buffer(buf.length - 118)
	    buf.copy(ciphertext, 0, 86, buf.length - 32)
	    var mac = new Buffer(32)
	    buf.copy(mac, 0, buf.length - 32)
	    const encryptedData = {
	      iv: iv,
	      ephemPublicKey: ephemPublicKey,
	      ciphertext: ciphertext,
	      mac: mac,
	    }
		
		const decryptKeyBuffer = bs58.decode(decryptKey).slice(1, 33);
	    const data = await eccrypto.decrypt(decryptKeyBuffer, encryptedData);
		return data
	}
	
	fragmentize(data, numberOfFragment) {
		var frag = []
		for (var i=0; i < numberOfFragment; i++) {
			frag[i] = Buffer.alloc( Math.ceil(data.length / numberOfFragment) )
		}
		
		const bitsDivided = 8 / numberOfFragment
		for (var i=0; i < data.length; i++) {
			for (var j=0; j < numberOfFragment; j++) {
				bitwise.buffer.modify(frag[j], bitwise.buffer.read(data, i*8 + j*bitsDivided, bitsDivided), i*bitsDivided)
			}
		}
		return frag
	}
	
	merge(fragments, mergedDataLength) {
		console.log(`merge(${mergedDataLength})`)
		console.log(fragments[0])
		console.log(fragments[1])
		var mergedData = Buffer.alloc(mergedDataLength)
		for (var i = 0; i < mergedDataLength; i++) {
			bitwise.buffer.modify(mergedData, bitwise.buffer.read(fragments[0], i*4, 4), i*8)
			bitwise.buffer.modify(mergedData, bitwise.buffer.read(fragments[1], i*4, 4), i*8+4)
		}
		return mergedData
	}
	
	async test(data_id, buyerPrivateKey) {
		const returnedData = await this.buyData(data_id, buyerPrivateKey)
		console.log( "Original data: " + data )
		console.log( "Returned data: " + returnedData )
		console.log( "Original data string: " + data.toString() )
		console.log( "Returned data string: " + returnedData.toString() )
		console.log( "Original bits: " + bitwise.bits.toString(bitwise.buffer.read(data), 4, ' ') )
		console.log( "Returned bits: " + bitwise.bits.toString(bitwise.buffer.read(returnedData), 4, ' ') )
		console.log( "Original hash: " + osb.getDataHash(data))
		console.log( "Returned hash: " + osb.getDataHash(returnedData))
	}
}

// module.exports.OASISBlocAPI = OASISBlocAPI



const config = {
  protocol: 'http',
  ipAddress: '127.0.0.1',
  port: 8888,
  chainId: 'cf057bbfb72640471fd910bcb67639c22df9f92470936cddc1ade0e2f2e7dc4f',
  dataTradeContractName: 'datatrader12',
//  privateKey: '5KeKLvERcoyTrT5yUyJecqj38fyBnoetQk28miLgYf5XponHwQH',
//  account: 'alice'
  privateKey: '5K5tF66j6qdq3soFUG11QvWiK4QWqVK5PL2884QNKqSfTStszWX',
  account: 'bob'
}
var osb = new OASISBlocAPI(config)

const data = Buffer.from('abcd')
const datatype = 'text'
const datatypename = 'type1'
const price = 99
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
//osb.registerData(data, datatype, datatypename, price, detailFields, period, decryptKeyList)

const buyerPrivateKey = '5JLiw8wAH8zMiQYYdYDM4PZPym5hmtFJ3EV94aLn2NXnAPnQaVF'
const data_id = 6

//osb.setAuthForContract()
//const returnedData = osb.buyData(data_id, buyerPrivateKey)
osb.test(data_id, buyerPrivateKey)

