const BigNumber = require("bignumber.js");
const qs = require("qs");
const web3 = require("web3");
import erc20abi from "./erc20abi.json";

let currentTrade = {};
let currentSelectSide;
let tokens;

async function init() {
  await listAvailableTokens();
}

async function listAvailableTokens() {
  console.log("Initialising...");
  let response = await fetch("https://tokens.coingecko.com/uniswap/all.json");
  // let response = await fetch(
  //   "https://wispy-bird-88a7.uniswap.workers.dev/?url=http://tokens.1inch.eth.link"
  // );
  let tokenListJSON = await response.json();
  console.log("Listing available tokens: ", tokenListJSON);

  tokens = tokenListJSON.tokens;
  console.log("Tokens:", tokens);

  // all tokens from the 'response'
  let parent = document.getElementById("token_list");
  for (const i in tokens) {
    let div = document.createElement("div");
    div.className = "token_row";

    let html = `<img class="token_list_img" src="${tokens[i].logoURI}">
      <span class="token_list_text">${tokens[i].symbol}</span>`;
    div.innerHTML = html;
    // populate the token box
    div.onclick = () => {
      selectToken(tokens[i]);
    };
    parent.appendChild(div);
  }
}

async function selectToken(token) {
  closeModal();
  currentTrade[currentSelectSide] = token;
  console.log("Current trade: ", currentTrade);
  renderInterface();
}

function renderInterface() {
  if (currentTrade.from) {
    document.getElementById("from_token_img").src = currentTrade.from.logoURI;
    document.getElementById("from_token_text").innerHTML =
      currentTrade.from.symbol;
  }
  if (currentTrade.to) {
    document.getElementById("to_token_img").src = currentTrade.to.logoURI;
    document.getElementById("to_token_text").innerHTML = currentTrade.to.symbol;
  }
}

async function connect() {
  if (typeof window.ethereum !== "undefined") {
    try {
      console.log("Connecting...");
      await ethereum.request({ method: "eth_requestAccounts" });
    } catch (error) {
      console.log(error);
    }

    document.getElementById("login_button").innerHTML = "Connected";
    document.getElementById("swap_button").disabled = false;
  } else {
    document.getElementById("login_button").innerHTML =
      "Please install MetaMask";
  }
}

function openModal(side) {
  currentSelectSide = side;
  document.getElementById("token_modal").style.display = "block";
}

function closeModal() {
  document.getElementById("token_modal").style.display = "none";
}

async function getPrice() {
  console.log("Getting price... ");
  if (
    !currentTrade.from ||
    !currentTrade.to ||
    !document.getElementById("from_amount").value
  )
    return;
  let amount = Number(
    document.getElementById("from_amount").value *
      10 ** currentTrade.from.decimals
  );

  const params = {
    sellToken: currentTrade.from.address,
    buyToken: currentTrade.to.address,
    sellAmount: amount,
  };

  // getting the swap price
  const response = await fetch(
    `https://api.0x.org/swap/v1/price?${qs.stringify(params)}`
  );

  // parsing response
  swapPriceJSON = await response.json();
  console.log("Price: ", swapPriceJSON);

  document.getElementById("to_amount").value =
    swapPriceJSON.buyAmount / 10 ** currentTrade.to.decimals;
  document.getElementById("gas_estimate").innerHTML =
    swapPriceJSON.estimatedGas;
}

async function getQuote(account) {
  console.log("Getting quote... ");
  if (
    !currentTrade.from ||
    !currentTrade.to ||
    !document.getElementById("from_amount").value
  )
    return;
  let amount = Number(
    document.getElementById("from_amount").value *
      10 ** currentTrade.from.decimals
  );

  const params = {
    sellToken: currentTrade.from.address,
    buyToken: currentTrade.to.address,
    sellAmount: amount,
    takerAddress: account,
  };

  // getting the quote
  const response = await fetch(
    `https://api.0x.org/swap/v1/price?${qs.stringify(params)}`
  );

  // parsing response
  swapQuoteJSON = await response.json();
  console.log("Price: ", swapQuoteJSON);

  document.getElementById("to_amount").value =
    swapQuoteJSON.buyAmount / 10 ** currentTrade.to.decimals;
  document.getElementById("gas_estimate").innerHTML =
    swapQuoteJSON.estimatedGas;

  return swapQuoteJSON;
}

async function trySwap() {
  let accounts = await ethereum.request({ method: "eth_accounts" });
  let takerAddress = accounts[0];
  console.log("takerAddress: ", takerAddress);

  const swapQuoteJSON = await getQuote(takerAddress);

  // set token allowance
  const web3 = new Web3(Web3.givenProvider);
  const fromTokenAddress = currentTrade.from.address;
  const ERC20ABI = erc20abi;
  const ERC20TokenContract = new web3.eth.Contract(ERC20ABI, fromTokenAddress);
  console.log("setup ERC20TokenContract: ", ERC20TokenContract);

  // approve
  const maxApproval = new BigNumber(2).pow(256).minus(1);
  const tx = await ERC20TokenContract.methods
    .approve(swapQuoteJSON.allowanceTarget, maxApproval)
    .send({ from: takerAddress })
    .then((tx) => {
      console.log("tx: ", tx);
    });

  const receipt = await web3.eth.sendTransaction(swapQuoteJSON);
  console.log("Receipt: ", receipt);
}

//

init();

document.getElementById("login_button").onclick = connect;

document.getElementById("from_token_select").onclick = () => {
  openModal("from");
};
document.getElementById("to_token_select").onclick = () => {
  openModal("to");
};
document.getElementById("modal_close").onclick = closeModal;

document.getElementById("from_amount").onblur = getPrice;
document.getElementById("swap_button").onclick = trySwap;
