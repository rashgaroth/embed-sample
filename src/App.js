import SpinnerLoading from "component/SpinnerLoading";
import { network } from "./config";
import { ethers } from "ethers";
import upbondServices from "lib/UpbondEmbed";
import { useEffect, useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import Web3 from "web3";
import erc20Abi from "./json/erc20Abi.json";
import MinterAbi from "./json/Minter.json";
import { RelayProvider } from "@opengsn/provider";
import { Stack } from "@mui/material";

const {
  REACT_APP_GSN_MUMBAI_MINTER,
  REACT_APP_GSN_MUMBAI_PAYMASTER,
  REACT_APP_EVENT_ID,
} = process.env;

/* 
  Read this:
  This concept actually can be also using hooks (functional), you may can decide what you want to do
  if you're using hooks, sure you can put the new Upbond({}) on the useState.
  We're using this example because we're usually using this method for implementing the @upbond/upbond-embed lib
*/

const App = () => {
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [signInfo, setSignInfo] = useState(null);
  const [btnLoading, setBtnLoading] = useState(false);
  const [isShowUserInfo, setIsShowUserInfo] = useState(false);
  const [showBc, setShowBc] = useState(false);
  const [isCopy, setIsCopy] = useState(false);
  const [txResult, setTxResult] = useState({});
  const [bcState, setBcState] = useState({
    address: "",
    chainId: 0,
    balance: 0,
    dwiBalance: 0,
  });
  const [isApproved, setIsApproved] = useState(false);
  const [approvedRes, setApprovedRes] = useState("0");
  const [toTransferAddress, setToTransferAddress] = useState(
    "0x673d6c086E84e9Db30bD20450e4A4c3D5f627824"
  );
  const [amountTransfer, setAmountTransfer] = useState("2");
  const _upbond = upbondServices.upbond.provider;
  const _web3 = upbondServices.web3;

  const checkAllowance = async () => {
    try {
      if (_upbond && account) {
        const web3 = new Web3(_upbond);
        const dwiToken = new web3.eth.Contract(
          erc20Abi,
          "0xf66bC1C717D7e852F427d599829083A4b7928023"
        );
        const allowance = await dwiToken.methods
          .allowance(account[0], "0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b")
          .call();
        if (allowance !== "0") {
          setIsApproved(true);
          setApprovedRes(allowance);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const initUpbond = async () => {
      setLoading(true);
      try {
        await upbondServices.init();
      } catch (error) {
        console.error(`Error initialization: `, error);
      }
      setLoading(false);
    };
    if (upbondServices.initialized) {
      return;
    }
    initUpbond();
  }, []);

  useEffect(() => {
    checkAllowance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_upbond, account]);

  const getBlockchainInfo = async (refresh = false) => {
    if (!refresh && showBc) {
      setShowBc(false);
      return;
    }
    const web3 = new Web3(_upbond);
    const [accounts, chainId] = await Promise.all([
      web3.eth.getAccounts(),
      web3.eth.getChainId(),
    ]);
    if (chainId === 80001) {
      const dwiToken = new web3.eth.Contract(
        erc20Abi,
        "0xf66bC1C717D7e852F427d599829083A4b7928023"
      );
      const dwBalance = await dwiToken.methods.balanceOf(account[0]).call();
      setBcState((curr) => ({
        ...curr,
        dwiBalance: ethers.utils.formatEther(dwBalance),
      }));
    }
    if (accounts) {
      const balance = await web3.eth.getBalance(accounts[0]);
      setShowBc(true);
      setBcState((curr) => ({
        ...curr,
        address: accounts[0],
        balance: `${parseInt(balance) / Math.pow(10, 18)} (MATIC)`,
        chainId,
      }));
    }
  };

  const login = async () => {
    setLoading(true);
    try {
      const login = await upbondServices.login();
      if (login.data !== null) {
        setAccount(login.accounts);
        setLoading(false);
        return;
      }
      setLoading(false);
    } catch (error) {
      toast.error(error.message || "Some error occured");
      setLoading(false);
      console.error(error);
      throw new Error(error);
    }
  };

  const getUser = async () => {
    if (isShowUserInfo) {
      setIsShowUserInfo(false);
      return;
    }
    setLoading(true);
    try {
      const getData = await upbondServices.getUserInfo();
      setUserInfo(getData);
      setIsShowUserInfo(true);
      setLoading(false);
    } catch (error) {
      toast.error(error.message || "Some error occured");
      console.error(error, "@errorOnGetUser");
      setIsShowUserInfo(true);
      setLoading(false);
    }
  };

  const signTransaction = async () => {
    try {
      setBtnLoading(true);
      setIsCopy(false);
      setLoading(true);
      const msgHash = Web3.utils.keccak256(
        "Signing Transaction for Upbond Embed!"
      );
      const signedMsg = await upbondServices.signTransaction(
        msgHash,
        account[0]
      );
      console.log(signedMsg);
      setSignInfo(signedMsg);
      setBtnLoading(false);
    } catch (error) {
      setBtnLoading(false);
      toast.error(error.message || "Some error occured");
      console.error(error);
      setLoading(false);
    }
  };

  const signWeb3Token = async () => {
    try {
      setBtnLoading(true);
      setIsCopy(false);
      const signedMsg = await upbondServices.signWeb3Token(account[0]);
      if (signedMsg) {
        setBtnLoading(false);
        setSignInfo(`${signedMsg}`);
      } else {
        setBtnLoading(false);
        setSignInfo("Output error. Maybe rejected or provider is invalid");
      }
    } catch (error) {
      setBtnLoading(false);
      toast.error(error.message || "Some error occured");
    }
  };

  const deploy = async () => {
    try {
      setBtnLoading(true);
      const web3 = new Web3(_upbond);
      const [addr] = await web3.eth.getAccounts();
      const nonce = await web3.eth.getTransactionCount(addr);

      const transaction = {
        from: addr,
        to: "0x550FBF95B0dF5AAbEb230649385d9f857f7561fF", // faucet address to return eth
        value: 1000000000000000000, // 1 ETH
        gas: 30000,
        nonce: nonce,
      };

      const tx = await web3.eth.sendTransaction(transaction);
      delete tx.logs;
      delete tx.contractAddress;
      setTxResult(tx);
      setBtnLoading(false);
    } catch (error) {
      setBtnLoading(false);
      console.error(error);
      toast.error(error.message || "Error occured!");
    }
  };

  const approve = async () => {
    try {
      await checkAllowance();

      // if (isApproved) {
      //   toast.error(`you're approved`)
      //   return
      // }

      setBtnLoading(true);
      const web3 = new Web3(_upbond);
      const dwiToken = new web3.eth.Contract(
        erc20Abi,
        "0xf66bC1C717D7e852F427d599829083A4b7928023"
      );
      const balance = await dwiToken.methods.balanceOf(account[0]).call();
      if (balance !== "0") {
        await dwiToken.methods
          .approve(
            "0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b",
            "115792089237316195423570985008687907853269984665640564039457584007913129639935"
          )
          .send({ from: account[0] });
        setBtnLoading(false);
        setIsApproved(true);
        toast.success(`Your account has been approved`);
      } else {
        setBtnLoading(false);
        toast.error(`You don't have DWI token`);
        return;
      }
    } catch (error) {
      setBtnLoading(false);
      console.error(error);
      toast.error(error.message || "Error occured!");
    }
  };

  const claimDWIToken = async () => {
    try {
      setBtnLoading(true);
      const wallet = new ethers.Wallet(
        "220f33e12dafecb1142f8ee444064596007f2fdf3f7bcec183575f959b9c13a3",
        new ethers.providers.JsonRpcProvider(network.rpcUrl)
      );
      console.log(`address:`, wallet.address);
      const dwiTokenContract = new ethers.Contract(
        "0xf66bC1C717D7e852F427d599829083A4b7928023",
        erc20Abi,
        wallet
      );
      const transfer = await dwiTokenContract.transfer(
        account[0],
        ethers.utils.parseEther("2"),
        {
          gasLimit: 61000,
        }
      );
      await transfer.wait();
      await getBlockchainInfo(true);
      setBtnLoading(false);
      toast.success(`Success transfer DWI token to your account`);
    } catch (error) {
      setBtnLoading(false);
      console.error(error);
      toast.error(error.message || "Error occured!");
    }
  };

  const transfer = async () => {
    try {
      setBtnLoading(true);
      const web3 = new Web3(_upbond);
      const dwiToken = new web3.eth.Contract(
        erc20Abi,
        "0xf66bC1C717D7e852F427d599829083A4b7928023"
      );
      const balance = await dwiToken.methods.balanceOf(account[0]).call();
      const decimal = await dwiToken.methods.decimals().call();
      console.log(
        decimal,
        "@decimal?",
        ethers.utils.parseUnits(balance, decimal).toString()
      );
      if (
        parseInt(balance) > 0 &&
        parseInt(amountTransfer) < parseInt(balance)
      ) {
        await dwiToken.methods
          .transfer(toTransferAddress, amountTransfer)
          .send({ from: account[0] });
        toast.success(`Success Transfer to ${toTransferAddress}`);
        setBtnLoading(false);
      } else {
        setBtnLoading(false);
        toast.error(`Amount exceed balance`);
      }
    } catch (error) {
      setBtnLoading(false);
      console.error(error);
      toast.error(error.message || "Error occured!");
    }
  };

  const minting = async () => {
    setBtnLoading(true);
    const theAddress = account[0];

    const conf = {
      paymasterAddress: REACT_APP_GSN_MUMBAI_PAYMASTER, //paymaster from contract address
      // Mumbai
      relayLookupWindowBlocks: 990,
      relayRegistrationLookupBlocks: 990,
      pastEventsQueryMaxPageSize: 990,
    };
    try {
      const relay = await RelayProvider.newProvider({
        provider: _upbond,
        config: conf,
      }).init();
      console.log(relay, "relay");
      const provider = new ethers.providers.Web3Provider(relay);
      console.log(provider, " provider");
      const signer = await provider.getSigner(theAddress);
      console.log(signer, "signers");
      const factory = new ethers.Contract(
        REACT_APP_GSN_MUMBAI_MINTER, //nft contract
        MinterAbi,
        signer
      );
      console.log(factory, "factory");

      const getDomain = await factory.DOMAIN_SEPARATOR();
      console.log(getDomain, "getDomain separator");
      const keccak = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes32", "address"],
          // [getDomain, accounts.address]
          [getDomain, theAddress]
        )
      );
      console.log(keccak, "getdomain");
      const claimNft = await factory.claim(REACT_APP_EVENT_ID, keccak);
      console.log(claimNft, "claimnft");
      const getTx = await claimNft.wait();
      console.log(getTx, "getTx");
      setBtnLoading(false);
      return getTx;
      // return txData;
    } catch (error) {
      setBtnLoading(false);
      console.log(error, "errorrrrrrrr");
      return "err";
    }
  };

  function truncateAllowance(str, n) {
    return str.length > n ? str.slice(0, n - 1) + `+${str.length}` : str;
  }

  useEffect(() => {
    const init = async () => {
      if (upbondServices.upbond) {
        if (upbondServices.upbond.isLoggedIn) {
          setLoading(true);
          const user = await upbondServices.getUserInfo();
          if (user) {
            const web3 = new Web3(_upbond);
            const account = await web3.eth.getAccounts();
            setAccount(account);
            setLoading(false);
          }
          setLoading(false);
        }
      }
    };
    init();
  }, [_upbond]);

  useEffect(() => {
    if (_upbond) {
      if (_upbond.on) {
        _upbond.on("accountsChanged", (accounts) => {
          console.log(`Account changed: ${accounts}`);
        });

        _upbond.on("chainChanged", (res) => {
          console.log(`Chain changed on: ${res}`);
        });

        _upbond.on("connect", (res) => {
          console.log("onConnect?", res);
        });
      }
    }
  }, [_upbond]);

  return (
    <div className="mx-auto max-w-2xl sm:px-6 lg:px-8">
      <header className="App-header">
        <p className="text-center uppercase font-bold my-3">
          sample dapps with upbond embed
        </p>
        <img
          src={"https://miro.medium.com/max/1200/1*jfdwtvU6V6g99q3G7gq7dQ.png"}
          className="w-1/2 mx-auto rounded-xl m-5"
          alt="UpbondBanner"
        />
        {account ? (
          <>
            <div>
              <p className="text-center">Account : {account}</p>
              <p className="text-center">
                DWI Approved Amount :{" "}
                <strong className="font-extrabold text-green-500">
                  {truncateAllowance(approvedRes, 7)}
                </strong>
              </p>

              <div className="flex justify-center mt-3 gap-3">
                <button
                  type="button"
                  disabled={btnLoading}
                  className="items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-green-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={getUser}
                >
                  Toggle User Info
                </button>
                <button
                  type="button"
                  disabled={btnLoading}
                  className="items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-green-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => getBlockchainInfo(false)}
                >
                  Toggle blockchain info
                </button>
                <button
                  type="button"
                  disabled={btnLoading}
                  className="items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  onClick={async () => await upbondServices.logout()}
                >
                  Logout
                </button>
              </div>
              {/* User Info */}
              {userInfo && isShowUserInfo && (
                <div className="text-center my-3">
                  <p className="font-bold">User Info</p>
                  <img
                    className="inline-block h-14 w-14 rounded-full"
                    src={userInfo.profileImage}
                    alt=""
                  />
                  <p>Name: {userInfo.name}</p>
                  <p>Email: {userInfo.email}</p>
                  <p>Login with: {userInfo.typeOfLogin}</p>
                  <p>Verifier: {userInfo.verifier}</p>
                </div>
              )}
              {/* bc info */}
              {showBc && bcState.chainId !== 0 && (
                <div className="text-center my-3">
                  <p className="font-bold">Blockchain Info</p>
                  {Object.keys(bcState).map((x) => (
                    <p className="text-black" key={x}>
                      {x}: {bcState[x]}
                    </p>
                  ))}
                </div>
              )}
              <div className="flex flex-1 justify-center space-x-5 mt-2">
                <button
                  type="button"
                  disabled={btnLoading}
                  className="disabled:bg-gray-500 items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  onClick={signTransaction}
                >
                  Sign Transaction
                </button>
                <button
                  type="button"
                  disabled={btnLoading}
                  className="disabled:bg-gray-500 items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={signWeb3Token}
                >
                  Sign Web3Token
                </button>
                <button
                  type="button"
                  disabled={btnLoading}
                  className="disabled:bg-gray-500 items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={deploy}
                >
                  Send Transaction
                </button>
                <button
                  type="button"
                  // disabled={btnLoading || isApproved}
                  className="disabled:bg-gray-500 items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={approve}
                >
                  Approve DWI token
                </button>
                <button
                  type="button"
                  disabled={btnLoading}
                  className="disabled:bg-gray-500 items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={claimDWIToken}
                >
                  Claim 2 DWI Token
                </button>
                <button
                  type="button"
                  disabled={btnLoading}
                  className="disabled:bg-gray-500 items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={minting}
                >
                  Mint
                </button>
              </div>
              <Stack direction={"row"} spacing={2} mt={2}>
                <button
                  type="button"
                  disabled={btnLoading}
                  className="disabled:bg-gray-500 mt-5 items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={transfer}
                >
                  Transfer DWI
                </button>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Address
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      value={toTransferAddress}
                      onChange={(e) => setToTransferAddress(e.target.value)}
                      name="address"
                      id="address"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="starts with 0x"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Amount
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      value={amountTransfer}
                      onChange={(e) => setAmountTransfer(e.target.value)}
                      name="amount"
                      id="amount"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="amount must be number"
                    />
                  </div>
                </div>
              </Stack>
              <p className="text-black mt-5">Output: </p>
              <div className="overflow-hidden rounded-lg bg-white shadow mt-2">
                <div className="px-4 py-5 sm:p-6 whitespace-pre-line break-words">
                  {signInfo ? signInfo : "Nothing"}
                </div>
              </div>
              {signInfo && (
                <button
                  type="button"
                  className="inline-flex mt-5 items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={async () => {
                    await navigator.clipboard.writeText(signInfo);
                    setIsCopy(true);
                  }}
                >
                  {isCopy ? "Copied" : "Copy"}
                </button>
              )}
              {Object.keys(txResult).length > 0 && (
                <p className="text-black mt-5">Transaction Output: </p>
              )}
              {Object.keys(txResult).length > 0 &&
                Object.keys(txResult).map((x) => (
                  <div
                    className="overflow-hidden rounded-lg bg-white shadow mt-2"
                    key={x}
                  >
                    <div className="px-4 py-5 sm:p-6 whitespace-pre-line break-words">
                      {x}: {txResult[x]}
                    </div>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <div className="flex justify-center">
            {loading === true ? (
              <SpinnerLoading />
            ) : (
              <div className="flex flex-1 flex-col space-y-3">
                <button
                  type="button"
                  className="mx-auto px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500  w-1/4"
                  onClick={login}
                >
                  Login 3.0
                </button>
              </div>
            )}
          </div>
        )}
      </header>
      <Toaster position="top-center" reverseOrder={false} />
    </div>
  );
};

export default App;
