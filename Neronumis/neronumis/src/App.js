import React from 'react';
import './App.css';
import type {Node} from 'react';
import { ethers } from 'ethers';
import { Icon } from '@iconify/react';

import TokenERC20 from './TokenERC20.json';
import Staking from './Staking.json';
function getValueFromExistingSmartContract(instance, account, address, jsonFile, functionName, inputTypeList, outputTypeList, chainInfo, setChainInfo, updateChecks, ...argsIn){
	
	var defaultSlate = {};

	function coverValueIfNecc(type, value){
		if (type.t === 'ListType'){
			return value.map((aVal, index)=>{
				return coverValueIfNecc(type.c, aVal);
			})
		}else if (type.t === 'Object'){
			var p = {};
			type.c.forEach((aC, index)=>{
				var cc = coverValueIfNecc(aC, value[aC.n]);
				p[aC.n] = cc;
			})
			return p;
		}else if (type.t === 'UInteger' || type.t === 'Integer'){
			if (!value.hex){
	  			return ethers.BigNumber.from(value);
			}
		}else if (type.t === 'Text String'){
			return value.split('.infura').join('');
		}
		return value;
	}

	function flattenType(inputType, aI){
		if (inputType.t === 'ListType'){
			return aI.map((anInput, index)=>{
				return flattenType(inputType.c, anInput);
			}).join(', ');
		}else if (inputType.t === 'UInteger' || inputType.t === 'Integer'){
			return aI.toString();
		}else if (inputType.t === 'Boolean'){
			if (aI){
				return 'true'
			}else{
				return 'false'
			}
		}else if (inputType.t === 'Object'){
			var cc = {};
			inputType.c.forEach((anInput, index)=>{
				var p = flattenType(anInput, aI[anInput.n]);
				cc[anInput.n] = p;
			})
			return JSON.stringify(cc);
		}else if (inputType.t === 'Bytes'){
			return '_';
		}else if (inputType.t === 'Text String' || inputType.t === 'Address'){
			return aI;
		}else{
			console.warn(inputType);
			return aI;
		}
	}

	if (instance && account){

		var args = argsIn.filter((aI, index)=>{
			return index < inputTypeList.length;
		})

		var flattenedInputs = args.map((aI, index)=>{
			var inputType = inputTypeList[+index];
			return flattenType(inputType, aI);
		})

		var point = [address, functionName].concat(flattenedInputs);
		var pOut = layoutFoundationForAnObject(point, chainInfo);
		if (pOut[0] !== undefined){
			return pOut;
		}else{

			function onSuccess(value){
				var k = {checked:true}
				if (outputTypeList.length === 1){
					k[0] = coverValueIfNecc(outputTypeList[0] , value);
				}else{
					for (var i = 0; i < outputTypeList.length; i++){
						var aVal = coverValueIfNecc(outputTypeList[i], value[i]);
						k[i] = aVal;
					}
				}
				replacement(point, chainInfo, k);
				setChainInfo({...chainInfo});
			}
			function onFail(e){
				console.log(e);
			}

			function actuallyCheck(){
				var gotNotChecked = false;
				for (var i = 0; i < updateChecks.length; i++){
					if (!updateChecks[i].checked){
						gotNotChecked = true;
						break;
					}
				}
				if (gotNotChecked){
					setTimeout(function(e){ actuallyCheck(); }, 500);
				}else{
					cryptoAdmin(instance, {add:address, json:jsonFile}, functionName, onSuccess, onFail, argsIn[argsIn.length - 1], ...args);

				}
			}

			actuallyCheck();
			return defaultSlate;
		}
	}else{
		return defaultSlate;
	}
}

function defaultValue(type, path){
	for (var i = 0; i < path.length; i++){
		if (path[i].t === 'l'){
			type = type.c;
		}else if (path[i].t === 'oP'){
			for (var j = 0; j < type.c.length; j++){
				if (type.c[j].n === path[i].v){
					type = type.c[j].t;
					break;
				}
			}
		}
	}

	function processDefault(type){
		if (type.t === 'ListType'){
			return [];
		}else if (type.t === 'Object'){
			var out = {};
			for (var i = 0; i < type.c.length; i++){
				out[type.c[i].n] = processDefault(type.c[i].t);
			}
		}else if (type.t === 'UInteger' || type.t === 'Integer'){
			return ethers.BigNumber.from('0');
		}else if (type.t === 'Text String'){
			return '-';
		}else if (type.t === 'Address'){
			return '0x0000000000000000000000000000000000000000'
		}else if (type.t === 'Boolean'){
			return false;
		}
	}
	return processDefault(type);
}

function parseFloater(x){
		if (!x){
				return 0;
		}else{
				return parseFloat(x);
		}
}

const DecimalInputRecall = ({defaultValue, style, className, onChange, idNos, inputValues, setInputValues, gVs}): Node => {

		var onChangeExt = onChange;
		var idOut = [idNos].concat(gVs).join('_');
		
		var value = (inputValues[idOut]? inputValues[idOut] : '');
		
		function setValue(valueIn){
				inputValues[idOut] = valueIn;
				setInputValues({...inputValues});
		}

		React.useEffect(() => {
				setValue(defaultValue + '');
		}, [defaultValue + '']);

		function onChange1(e){
				var valueOut = e.target.value;
				setValue(valueOut);
				if (onChangeExt){
						if (!isDecimalText(valueOut) && valueOut !== '' && valueOut !== '+' && valueOut !== '.'){
								return;
						}
						if (valueOut === '' || valueOut === '+' ||valueOut === '.'){
								valueOut = '0';
						}
						onChangeExt(+valueOut);
				}
		}

		return <input className={className} value={value} onChange={onChange1} disabled={style.disabled} placeholder={style.placeholder} style={style} />;  
}

function cryptoAdmin(instance, item, name, onSuccess, onFail, events, ...args) {
	const provider = new ethers.providers.Web3Provider(instance)
	const signer = provider.getSigner()
	const contract = new ethers.Contract(item.add, item.json.abi, signer)
	try {
		contract[name](...args).then(value=>{
			onSuccess(value);
		}).catch(err=>{
			onFail(err.message);
		});
	} catch (err) {
		onFail(err.message)
	}

	events.forEach((anEvent, index)=>{
		if (anEvent.f){
			const event1 = contract.filters[anEvent.k.name](...anEvent.k.conditions);
			contract.once(event1, ()=>{
				anEvent.f();
			})
		}else{
			const event = contract.filters[anEvent.name](...anEvent.conditions);
			contract.on(event, ()=>{
				cryptoAdmin(instance, item, name, onSuccess, onFail, [], ...args);
			})
		}
	})
}

function textToDecimal(input){
		var p = isDecimalText(input);
		if (!p){
				return 0;
		}else{
				return +input;
		}
}

function makeADecimalTextIntoLongText(decimalText, digits){
		var locOfDot = decimalText.indexOf('.');
		if (locOfDot === -1){
				return decimalText + makeDigits(digits);
		}else{
				var before = decimalText.substr(0, locOfDot);
				var after = decimalText.substr(locOfDot + 1);
				if (after.length > digits){
						return before + after.substr(0, digits);      
				}else{
						return before + after + makeDigits(digits - after.length);
				}
		}
}

function makeDigits(digits){
		var x = '';
		for (var i = 0; i < digits; i++){
				x += '0';
		}
		return x;
}

function shortenName(text){
				if (text.length < 9){
								return text;
				}    
				return text.substr(0, 2) + '...' + text.substr(text.length - 4);
}

function layoutFoundationForAnObject(list, chainInfo){
	var p = chainInfo;
	for (var i = 0; i < list.length; i++){
		var p1 = p[list[i]];
		if (!p1){
			p[list[i]] = {};
			p1 = p[list[i]];
		}
		p = p1;
	}
	return p;
}

function replacement(list, chainInfo, object){
	var p = chainInfo;
	for (var i = 0; i < list.length; i++){
		if (i === list.length - 1){
			p[list[i]] = object;
		}else{
			p = p[list[i]];
		}
	}
}

function isDecimalText(thisVal){
				if (thisVal && (typeof thisVal === 'string' || thisVal instanceof String)){
						var regex3 = /^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)$/
						return thisVal.match(regex3);    
				}
				return false;
		}


const App = (): Node => {

	const [inputValues, setInputValues] = React.useState({})
	const [instance, setInstance] = React.useState(false);
	const [chainInfo, setChainInfo] = React.useState({});
	const [account, setAccount] = React.useState(false);
	const [chainId, setChainId] = React.useState(ethers.BigNumber.from('0'));
	function clickActionfe_1__s_c5_8b1e7b8e_k_c6_2ffa7705_i_c14_0e0f1498_i_c14_24e8b977(e){
		window.open('https://bit.ly/3SNqk0d');
		e.stopPropagation();
	}
	function clickActionfe_1__s_c7_99071459_k_c78_8da675d7_i_c78_74805029_i_c10_48f532f6_i_c14_e8969b05_i_c14_243b28f4(e){
		if(!(account === false)
		) {
			cryptoAdmin(instance, {add:'0xf840099E75199255905284C38708d594546560a4', json:TokenERC20}, 'approve', function(){}
			, function(e1){
			}, [{k:{name:"Approval", conditions:[account, '0x5f1e33def054e7AFA83F05F5D4b087e3D9c19DF6']}, f:function(){
			cryptoAdmin(instance, {add:'0x5f1e33def054e7AFA83F05F5D4b087e3D9c19DF6', json:Staking}, 'stake', function(){}
			, function(e2){
			}, [], ethers.BigNumber.from( makeADecimalTextIntoLongText(textToDecimal(inputValues['fe 1 _s c7_99071459 k c78_8da675d7 i c78_74805029 i c10_48f532f6 i c14_53456f04 i c14_11be33c5']).toString(), ethers.BigNumber.from('18').toNumber()) ));}}], '0x5f1e33def054e7AFA83F05F5D4b087e3D9c19DF6', ethers.BigNumber.from( makeADecimalTextIntoLongText(textToDecimal(inputValues['fe 1 _s c7_99071459 k c78_8da675d7 i c78_74805029 i c10_48f532f6 i c14_53456f04 i c14_11be33c5']).toString(), ethers.BigNumber.from('18').toNumber()) ));
		}else{
			connectWallet(); 
		};
		e.stopPropagation();
	}
	function clickActionfe_1__s_c7_99071459_k_c78_8da675d7_i_c78_74805029_i_c14_73be1183_i_c14_e8969b05_i_c14_243b28f4(e){
		if(!(account === false)
		) {
			cryptoAdmin(instance, {add:'0x5f1e33def054e7AFA83F05F5D4b087e3D9c19DF6', json:Staking}, 'withdrawInterestWithoutUnstaking', function(){}
			, function(e1){
			}, [], ethers.BigNumber.from( makeADecimalTextIntoLongText(textToDecimal(inputValues['fe 1 _s c7_99071459 k c78_8da675d7 i c78_74805029 i c14_73be1183 i c14_53456f04 i c14_11be33c5']).toString(), ethers.BigNumber.from('18').toNumber()) ));
		}else{
			connectWallet(); 
		};
		e.stopPropagation();
	}
	function clickActionfe_1__s_c7_99071459_k_c78_8da675d7_i_c78_74805029_i_c14_f6014b54_i_c14_e8969b05_i_c14_243b28f4(e){
		if(!(account === false)
		) {
			cryptoAdmin(instance, {add:'0x5f1e33def054e7AFA83F05F5D4b087e3D9c19DF6', json:Staking}, 'unstake', function(){}
			, function(e1){
			}, [], ethers.BigNumber.from( makeADecimalTextIntoLongText(textToDecimal(inputValues['fe 1 _s c7_99071459 k c78_8da675d7 i c78_74805029 i c14_f6014b54 i c14_53456f04 i c14_11be33c5']).toString(), ethers.BigNumber.from('18').toNumber()) ));
		}else{
			connectWallet(); 
		};
		e.stopPropagation();
	}
	function clickActioncn_c97_2eb6bd27_nv_i_c1_3a5a4a1e(e){
		connectWallet(); 
		e.stopPropagation();
	}
	function getInfo(instanceIn){
		setInstance(instanceIn); setChainInfo({}); 
	}async function connectWallet(){
		if (account){
			return;
		}

		const Web3Modal = window.Web3Modal.default;
		const WalletConnectProvider = window.WalletConnectProvider.default;
		const Fortmatic = window.Fortmatic;

		const providerOptions = {
			walletconnect: { 
				package: WalletConnectProvider,
				options: { infuraId: '8043bb2cf99347b1bfadfb233c5325c0'}
			},
			fortmatic: {
				package: Fortmatic,
				options: {key: 'pk_test_391E26A3B43A3350'}
			}
		};

		const web3Modal = new Web3Modal({
			cacheProvider: false, // optional
			providerOptions, // required
		});
		web3Modal.clearCachedProvider();

		const d = new Date();
		let time = d.getTime();

		try {
			const instance = await web3Modal.connect(); getInfo(instance);

			// Subscribe to accounts change
			instance.on('accountsChanged', (accounts) => {
				if (accounts.length > 0){
					setAccount(accounts[0]); document.account = accounts[0]; getInfo(instance);
				}else{
					setAccount(false); document.account = false; setInstance(false); 
				}
			});

			instance.on('chainChanged', (chainId) => {
				setChainId(chainId); getInfo(instance);
			});
			const provider = new ethers.providers.Web3Provider(instance)
			const signer = provider.getSigner()
			signer.getAddress().then(function(account){
				setAccount(account);
				document.account = account;
				provider.getNetwork().then(function(network){
					setChainId(ethers.BigNumber.from(network.chainId));
			        if (network.chainId !== 1){
			          if (window.ethereum){window.ethereum.request({method: 'wallet_switchEthereumChain',params: [{chainId:1}]});
			          }          
			        }
				})
			}).catch((err)=>{
				console.log(err);
			});

		} catch(e) {
			const d1 = new Date();
			let time1 = d1.getTime();
			if (time1 - time < 100){
				if (e.message === 'User Rejected'){
					window.alert('It seems you had been previously asked to connect to a site via metamask but the query was not completed. Please open up Metamask (by clicking on the top right icon) and click Connect in the pop-up. If that fails, please refresh this page.')
				}
			}
			return;
		}
	}
	function nav_c97_2eb6bd27(){
		return (
		<nav className='navbar navbar-dark' style={{backgroundColor:'rgb(0, 0, 0)'}}>
			<span className='navbar-brand' style={{fontFamily:'Cabin', color:'rgb(238, 238, 238)', fontWeight:(1 ? 'bold' : 'normal')}}><img src={'https://www.cues.sg/client_pictures/380_Nj0t6Cdg.png'} style={{margin:10,width:'2.86em'}} alt='logo' />{'Neronumis'}</span>
			
<button style={{color:'rgb(255, 255, 255)', fontWeight:(1 ? 'bold' : 'normal'), backgroundColor:'rgb(68, 68, 68)', cursor:'pointer'}} className='btn'  onClick={clickActioncn_c97_2eb6bd27_nv_i_c1_3a5a4a1e} ><Icon height={'20px'} icon={'logos:ethereum-color'} style={{color:'rgb(141, 141, 141)'}} /> {(!(account === false) ? (chainId.eq(ethers.BigNumber.from(1)) ? shortenName(account) : ('Connect to the ' + 'Ethereum' + ' chain')) : 'Connect Wallet')}</button>
		</nav>)
	}
	return <div style={{color:'rgb(0, 0, 0)', backgroundColor:'rgb(0, 0, 0)'}}>{nav_c97_2eb6bd27()}
		<div style={{position:'relative', width:'100vw', overflow:'hidden', zIndex:0, minHeight:'20em', backgroundColor:''}}>
			<div><div style={{backgroundColor:'rgb(215, 168, 110)', borderStyle:'none', borderWidth:1, borderColor:'rgb(255, 235, 193)', borderRadius:'0.72em'}} className=' mt-2 mb-2 container-fluid'>
				<div><div style={{backgroundColor:'rgb(0, 0, 0)'}} className='row justify-content-center align-items-start'>
					<div  className=' col-3'><img alt='generatedImage' src={'https://www.cues.sg/client_pictures/381_pOdmnZNJ.png'} style={{borderWidth:0, width:'100%'}}/></div>
				</div></div>
				<div><div style={{backgroundColor:'rgb(0, 0, 0)'}} className='row justify-content-center align-items-start'>
					<button style={{cursor:'pointer'}} className='btn btn-normalDarkBrown col-4'  onClick={clickActionfe_1__s_c5_8b1e7b8e_k_c6_2ffa7705_i_c14_0e0f1498_i_c14_24e8b977} >{'Add NERO to Metamask'}</button>
				</div></div>
			</div></div>
		</div>
		<div style={{position:'relative', width:'100vw', overflow:'hidden', zIndex:0, minHeight:'31.86em', backgroundColor:''}}>
			<div><div style={{backgroundColor:'rgb(57, 62, 70)', borderStyle:'solid', borderWidth:1, borderColor:'rgb(57, 62, 70)', borderRadius:'0.90em'}} className=' mt-1 mb-1 ml-0 ml-md-0 mr-0 container-fluid'>
				<div><div className='row justify-content-start align-items-start'>
					<div className=' col-12 col-md-4'><div style={{backgroundColor:'rgb(57, 62, 70)', borderStyle:'solid', borderWidth:1, borderColor:'rgb(57, 62, 70)', borderRadius:'0.90em'}} className=' mt-1 mb-1 ml-0 ml-md-0 mr-0 container-fluid'>
						<div><div className='row justify-content-start align-items-start'>
							<div className=' col-12 text-center' style={{lineHeight:'1.67em', borderWidth:0, padding:10}}><span key={0} style={{color:'#14ffec'}}><b><span style={{fontSize:'30px'}}><span style={{fontFamily:'Cabin'}}>Stake NERO</span></span></b></span>
							</div>
						</div></div>
						<div><div className='row justify-content-start align-items-start'>
							<div className=' col-12 text-center' style={{borderWidth:0, padding:10}}><span key={0} style={{color:'rgb(255, 255, 255)'}}><span style={{backgroundColor:'rgb(57, 62, 70)'}}><span style={{fontSize:'0.8em'}}><span style={{fontFamily:'Cabin'}}>Stake your NERO to receive 38,5% fixed APY</span></span></span></span>
							</div>
						</div></div>
						<div><div className='row no-gutters justify-content-start align-items-start'>
							<div className=' col-7text-left' style={{lineHeight:'1.67em', borderWidth:0, padding:0}}><span key={0} style={{color:'rgb(255, 255, 255)'}}><b><span style={{fontSize:'14px'}}><span style={{fontFamily:'Cabin'}}>Total Balance</span></span></b></span>
							</div>
							<div className=' col-5text-left' style={{lineHeight:'1.67em', borderWidth:0, padding:0}}>
								<span key={0} style={{color:'rgb(44, 204, 195)'}}>{(ethers.BigNumber.from('18').gt(ethers.BigNumber.from('8')) ? function(outputTypeList, pathDownList){ var out = getValueFromExistingSmartContract(instance, account, '0xf840099E75199255905284C38708d594546560a4', TokenERC20, 'balanceOf', [{t:'Address'}], outputTypeList, chainInfo, setChainInfo, [], account, []); if (out.checked){return out[0];}else{return defaultValue(outputTypeList[0], pathDownList)}}([{t:'UInteger'}], []).div(ethers.BigNumber.from('10').pow(ethers.BigNumber.from('18').sub(ethers.BigNumber.from('8')))).toNumber()/(10 ** ethers.BigNumber.from('8').toNumber()) : function(outputTypeList, pathDownList){ var out = getValueFromExistingSmartContract(instance, account, '0xf840099E75199255905284C38708d594546560a4', TokenERC20, 'balanceOf', [{t:'Address'}], outputTypeList, chainInfo, setChainInfo, [], account, []); if (out.checked){return out[0];}else{return defaultValue(outputTypeList[0], pathDownList)}}([{t:'UInteger'}], []).toNumber() / (10 ** ethers.BigNumber.from('18').toNumber())).toFixed(ethers.BigNumber.from('8').toNumber() > 100 ? 100 : ethers.BigNumber.from('8').toNumber())}</span>
							</div>
						</div></div>
						<div><div className='row no-gutters justify-content-start align-items-start'>
							<div  className=' col-12 mt-3 mb-2 ml-0 mr-0' style={{height:'100%', padding:'0'}}><DecimalInputRecall defaultValue={parseFloater((ethers.BigNumber.from('18').gt(ethers.BigNumber.from('8')) ? function(outputTypeList, pathDownList){ var out = getValueFromExistingSmartContract(instance, account, '0xf840099E75199255905284C38708d594546560a4', TokenERC20, 'balanceOf', [{t:'Address'}], outputTypeList, chainInfo, setChainInfo, [], account, []); if (out.checked){return out[0];}else{return defaultValue(outputTypeList[0], pathDownList)}}([{t:'UInteger'}], []).div(ethers.BigNumber.from('10').pow(ethers.BigNumber.from('18').sub(ethers.BigNumber.from('8')))).toNumber()/(10 ** ethers.BigNumber.from('8').toNumber()) : function(outputTypeList, pathDownList){ var out = getValueFromExistingSmartContract(instance, account, '0xf840099E75199255905284C38708d594546560a4', TokenERC20, 'balanceOf', [{t:'Address'}], outputTypeList, chainInfo, setChainInfo, [], account, []); if (out.checked){return out[0];}else{return defaultValue(outputTypeList[0], pathDownList)}}([{t:'UInteger'}], []).toNumber() / (10 ** ethers.BigNumber.from('18').toNumber())).toFixed(ethers.BigNumber.from('8').toNumber() > 100 ? 100 : ethers.BigNumber.from('8').toNumber()))} className='form-control text-center' style={{placeholder:'', backgroundColor:'rgb(57, 62, 70)', color:'rgb(255, 255, 255)', borderStyle:'solid', borderWidth:1, borderColor:'rgb(255, 255, 255)', disabled:false, padding:6, height:'100%'}} gVs={[]} setInputValues={setInputValues} inputValues={inputValues} idNos={'fe 1 _s c7_99071459 k c78_8da675d7 i c78_74805029 i c10_48f532f6 i c14_53456f04 i c14_11be33c5'}/>{function(){ var p = []; var valueOut = inputValues['fe 1 _s c7_99071459 k c78_8da675d7 i c78_74805029 i c10_48f532f6 i c14_53456f04 i c14_11be33c5']; if (!isDecimalText(valueOut) && valueOut){ p.push('Not a Decimal');};  if (p.length > 0){ return <center><p style={{color:'red'}}>{p.join(', ')}</p></center>}else{ return null; }}()}</div>
						</div></div>
						<div><div className='row no-gutters justify-content-start align-items-start'>
							<button style={{cursor:'pointer'}} className='btn btn-info col-12 mt-2 mb-4'  onClick={clickActionfe_1__s_c7_99071459_k_c78_8da675d7_i_c78_74805029_i_c10_48f532f6_i_c14_e8969b05_i_c14_243b28f4} ><Icon height={'20px'} icon={'openmoji:rocket'} /> {'Stake NERO'}</button>
						</div></div>
					</div></div>
					<div className=' col-12 col-md-4'><div style={{backgroundColor:'rgb(57, 62, 70)', borderStyle:'solid', borderWidth:1, borderColor:'rgb(57, 62, 70)', borderRadius:'0.90em'}} className=' mt-1 mb-1 ml-0 ml-md-0 mr-0 container-fluid'>
						<div><div className='row justify-content-start align-items-start'>
							<div className=' col-12 text-center' style={{lineHeight:'1.67em', borderWidth:0, padding:10}}><span key={0} style={{color:'#14ffec'}}><b><span style={{fontSize:'30px'}}><span style={{fontFamily:'Cabin'}}>Claim Rewards</span></span></b></span>
							</div>
						</div></div>
						<div><div className='row justify-content-start align-items-start'>
							<div className=' col-12 text-center' style={{borderWidth:0, padding:10}}><span key={0} style={{color:'rgb(255, 255, 255)'}}><span style={{backgroundColor:'rgb(57, 62, 70)'}}><span style={{fontSize:'0.8em'}}><span style={{fontFamily:'Cabin'}}>Claim your rewards only</span></span></span></span>
							</div>
						</div></div>
						<div><div className='row no-gutters justify-content-start align-items-start'>
							<div className=' col-7text-left' style={{lineHeight:'1.67em', borderWidth:0, padding:0}}><span key={0} style={{color:'#ffffff'}}><b><span style={{fontSize:'14px'}}><span style={{fontFamily:'Cabin'}}>Total Rewards</span></span></b></span>
							</div>
							<div className=' col-5text-left' style={{lineHeight:'1.67em', borderWidth:0, padding:0}}>
								<span key={0} style={{color:'rgb(44, 204, 195)'}}>{(ethers.BigNumber.from('18').gt(ethers.BigNumber.from('8')) ? function(outputTypeList, pathDownList){ var out = getValueFromExistingSmartContract(instance, account, '0x5f1e33def054e7AFA83F05F5D4b087e3D9c19DF6', Staking, 'interestEarnedUpToNowBeforeTaxesAndNotYetWithdrawn', [{t:'Address'}], outputTypeList, chainInfo, setChainInfo, [], account, []); if (out.checked){return out[0];}else{return defaultValue(outputTypeList[0], pathDownList)}}([{t:'UInteger'}], []).div(ethers.BigNumber.from('10').pow(ethers.BigNumber.from('18').sub(ethers.BigNumber.from('8')))).toNumber()/(10 ** ethers.BigNumber.from('8').toNumber()) : function(outputTypeList, pathDownList){ var out = getValueFromExistingSmartContract(instance, account, '0x5f1e33def054e7AFA83F05F5D4b087e3D9c19DF6', Staking, 'interestEarnedUpToNowBeforeTaxesAndNotYetWithdrawn', [{t:'Address'}], outputTypeList, chainInfo, setChainInfo, [], account, []); if (out.checked){return out[0];}else{return defaultValue(outputTypeList[0], pathDownList)}}([{t:'UInteger'}], []).toNumber() / (10 ** ethers.BigNumber.from('18').toNumber())).toFixed(ethers.BigNumber.from('8').toNumber() > 100 ? 100 : ethers.BigNumber.from('8').toNumber())}</span><br/>
							</div>
						</div></div>
						<div><div className='row no-gutters justify-content-start align-items-start'>
							<div  className=' col-12 mt-3 mb-2 ml-0 mr-0' style={{height:'100%', padding:'0'}}><DecimalInputRecall defaultValue={parseFloater((ethers.BigNumber.from('18').gt(ethers.BigNumber.from('8')) ? function(outputTypeList, pathDownList){ var out = getValueFromExistingSmartContract(instance, account, '0x5f1e33def054e7AFA83F05F5D4b087e3D9c19DF6', Staking, 'interestEarnedUpToNowBeforeTaxesAndNotYetWithdrawn', [{t:'Address'}], outputTypeList, chainInfo, setChainInfo, [], account, []); if (out.checked){return out[0];}else{return defaultValue(outputTypeList[0], pathDownList)}}([{t:'UInteger'}], []).div(ethers.BigNumber.from('10').pow(ethers.BigNumber.from('18').sub(ethers.BigNumber.from('8')))).toNumber()/(10 ** ethers.BigNumber.from('8').toNumber()) : function(outputTypeList, pathDownList){ var out = getValueFromExistingSmartContract(instance, account, '0x5f1e33def054e7AFA83F05F5D4b087e3D9c19DF6', Staking, 'interestEarnedUpToNowBeforeTaxesAndNotYetWithdrawn', [{t:'Address'}], outputTypeList, chainInfo, setChainInfo, [], account, []); if (out.checked){return out[0];}else{return defaultValue(outputTypeList[0], pathDownList)}}([{t:'UInteger'}], []).toNumber() / (10 ** ethers.BigNumber.from('18').toNumber())).toFixed(ethers.BigNumber.from('8').toNumber() > 100 ? 100 : ethers.BigNumber.from('8').toNumber()))} className='form-control text-center' style={{placeholder:'', backgroundColor:'rgb(57, 62, 70)', color:'rgb(255, 255, 255)', borderStyle:'solid', borderWidth:1, borderColor:'rgb(255, 255, 255)', disabled:false, padding:6, height:'100%'}} gVs={[]} setInputValues={setInputValues} inputValues={inputValues} idNos={'fe 1 _s c7_99071459 k c78_8da675d7 i c78_74805029 i c14_73be1183 i c14_53456f04 i c14_11be33c5'}/>{function(){ var p = []; var valueOut = inputValues['fe 1 _s c7_99071459 k c78_8da675d7 i c78_74805029 i c14_73be1183 i c14_53456f04 i c14_11be33c5']; if (!isDecimalText(valueOut) && valueOut){ p.push('Not a Decimal');};  if (p.length > 0){ return <center><p style={{color:'red'}}>{p.join(', ')}</p></center>}else{ return null; }}()}</div>
						</div></div>
						<div><div className='row no-gutters justify-content-start align-items-start'>
							<button style={{cursor:'pointer'}} className='btn btn-info col-12 mt-2 mb-4'  onClick={clickActionfe_1__s_c7_99071459_k_c78_8da675d7_i_c78_74805029_i_c14_73be1183_i_c14_e8969b05_i_c14_243b28f4} ><Icon height={'20px'} icon={'fluent:arrow-download-20-regular'} /> {'Claim Rewards'}</button>
						</div></div>
					</div></div>
					<div className=' col-12 col-md-4'><div style={{backgroundColor:'rgb(57, 62, 70)', borderStyle:'solid', borderWidth:1, borderColor:'rgb(57, 62, 70)', borderRadius:'0.90em'}} className=' mt-1 mb-1 ml-0 ml-md-0 mr-0 container-fluid'>
						<div><div className='row justify-content-start align-items-start'>
							<div className=' col-12 text-center' style={{lineHeight:'1.67em', borderWidth:0, padding:10}}><span key={0} style={{color:'#14ffec'}}><b><span style={{fontSize:'30px'}}><span style={{fontFamily:'Cabin'}}>Withdrawal</span></span></b></span>
							</div>
						</div></div>
						<div><div className='row justify-content-start align-items-start'>
							<div className=' col-12 text-center' style={{borderWidth:0, padding:10}}><span key={0} style={{color:'rgb(255, 255, 255)'}}><span style={{backgroundColor:'rgb(57, 62, 70)'}}><span style={{fontSize:'0.8em'}}><span style={{fontFamily:'Nunito, sans-serif'}}>Unstake your NERO and claim your rewards</span></span></span></span>
							</div>
						</div></div>
						<div><div className='row no-gutters justify-content-start align-items-start'>
							<div className=' col-7text-left' style={{lineHeight:'1.67em', borderWidth:0, padding:0}}><span key={0} style={{color:'rgb(255, 255, 255)'}}><b><span style={{fontSize:'14px'}}><span style={{fontFamily:'Cabin'}}>Total Staked</span></span></b></span>
							</div>
							<div className=' col-5text-left' style={{lineHeight:'1.67em', borderWidth:0, padding:0}}>
								<span key={0} style={{color:'rgb(44, 204, 195)'}}>{(ethers.BigNumber.from('18').gt(ethers.BigNumber.from('8')) ? function(outputTypeList, pathDownList){ var out = getValueFromExistingSmartContract(instance, account, '0x5f1e33def054e7AFA83F05F5D4b087e3D9c19DF6', Staking, 'addressMap', [{t:'Address'}], outputTypeList, chainInfo, setChainInfo, [], account, []); if (out.checked){return out[1];}else{return defaultValue(outputTypeList[1], pathDownList)}}([{t:'UInteger'}, {t:'UInteger'}, {t:'UInteger'}, {t:'UInteger'}, {t:'UInteger'}], []).div(ethers.BigNumber.from('10').pow(ethers.BigNumber.from('18').sub(ethers.BigNumber.from('8')))).toNumber()/(10 ** ethers.BigNumber.from('8').toNumber()) : function(outputTypeList, pathDownList){ var out = getValueFromExistingSmartContract(instance, account, '0x5f1e33def054e7AFA83F05F5D4b087e3D9c19DF6', Staking, 'addressMap', [{t:'Address'}], outputTypeList, chainInfo, setChainInfo, [], account, []); if (out.checked){return out[1];}else{return defaultValue(outputTypeList[1], pathDownList)}}([{t:'UInteger'}, {t:'UInteger'}, {t:'UInteger'}, {t:'UInteger'}, {t:'UInteger'}], []).toNumber() / (10 ** ethers.BigNumber.from('18').toNumber())).toFixed(ethers.BigNumber.from('8').toNumber() > 100 ? 100 : ethers.BigNumber.from('8').toNumber())}</span><br/>
							</div>
						</div></div>
						<div><div className='row no-gutters justify-content-start align-items-start'>
							<div  className=' col-12 mt-3 mb-2 ml-0 mr-0' style={{height:'100%', padding:'0'}}><DecimalInputRecall defaultValue={parseFloater((ethers.BigNumber.from('18').gt(ethers.BigNumber.from('8')) ? function(outputTypeList, pathDownList){ var out = getValueFromExistingSmartContract(instance, account, '0x5f1e33def054e7AFA83F05F5D4b087e3D9c19DF6', Staking, 'addressMap', [{t:'Address'}], outputTypeList, chainInfo, setChainInfo, [], account, []); if (out.checked){return out[1];}else{return defaultValue(outputTypeList[1], pathDownList)}}([{t:'UInteger'}, {t:'UInteger'}, {t:'UInteger'}, {t:'UInteger'}, {t:'UInteger'}], []).div(ethers.BigNumber.from('10').pow(ethers.BigNumber.from('18').sub(ethers.BigNumber.from('8')))).toNumber()/(10 ** ethers.BigNumber.from('8').toNumber()) : function(outputTypeList, pathDownList){ var out = getValueFromExistingSmartContract(instance, account, '0x5f1e33def054e7AFA83F05F5D4b087e3D9c19DF6', Staking, 'addressMap', [{t:'Address'}], outputTypeList, chainInfo, setChainInfo, [], account, []); if (out.checked){return out[1];}else{return defaultValue(outputTypeList[1], pathDownList)}}([{t:'UInteger'}, {t:'UInteger'}, {t:'UInteger'}, {t:'UInteger'}, {t:'UInteger'}], []).toNumber() / (10 ** ethers.BigNumber.from('18').toNumber())).toFixed(ethers.BigNumber.from('8').toNumber() > 100 ? 100 : ethers.BigNumber.from('8').toNumber()))} className='form-control text-center' style={{placeholder:'', backgroundColor:'rgb(57, 62, 70)', color:'rgb(255, 255, 255)', borderStyle:'solid', borderWidth:1, borderColor:'rgb(255, 255, 255)', disabled:false, padding:6, height:'100%'}} gVs={[]} setInputValues={setInputValues} inputValues={inputValues} idNos={'fe 1 _s c7_99071459 k c78_8da675d7 i c78_74805029 i c14_f6014b54 i c14_53456f04 i c14_11be33c5'}/>{function(){ var p = []; var valueOut = inputValues['fe 1 _s c7_99071459 k c78_8da675d7 i c78_74805029 i c14_f6014b54 i c14_53456f04 i c14_11be33c5']; if (!isDecimalText(valueOut) && valueOut){ p.push('Not a Decimal');};  if (p.length > 0){ return <center><p style={{color:'red'}}>{p.join(', ')}</p></center>}else{ return null; }}()}</div>
						</div></div>
						<div><div className='row no-gutters justify-content-start align-items-start'>
							<button style={{cursor:'pointer'}} className='btn btn-info col-12 mt-2 mb-4'  onClick={clickActionfe_1__s_c7_99071459_k_c78_8da675d7_i_c78_74805029_i_c14_f6014b54_i_c14_e8969b05_i_c14_243b28f4} ><Icon height={'20px'} icon={'carbon:send-alt-filled'} /> {'Withdrawal'}</button>
						</div></div>
					</div></div>
				</div></div>
			</div></div>
		</div></div>
}

export default App;