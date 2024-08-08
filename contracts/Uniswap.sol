// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { ERC20 } from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import { ReentrancyGuard } from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';

contract CustomToken is ERC20 {
  constructor(string memory tokenName, string memory tokenSymbol) ERC20(tokenName, tokenSymbol) {
    _mint(msg.sender, 100000 * 1e18);
  }
}

contract Uniswap is ReentrancyGuard, Ownable {
  string[] public tokens = ['GAL', 'JOC', 'WETH'];
  mapping(string => CustomToken) public tokenInstanceMap;
  uint immutable ethValue = 100000 * 1e12;

  event Withdrawal(address indexed to, uint amount);
  event SwapEthToToken(address indexed user, string tokenName, uint ethAmount, uint tokenAmount);
  event SwapTokenToEth(address indexed user, string tokenName, uint tokenAmount, uint ethAmount);
  event SwapTokenToToken(address indexed user, string srcTokenName, string destTokenName, uint amount);

  constructor() Ownable(msg.sender) {
    uint length = tokens.length;

    for (uint i = 0; i < length; i++) {
      CustomToken token = new CustomToken(tokens[i], tokens[i]);
      tokenInstanceMap[tokens[i]] = token;
    }
  }

  function getBalance(string memory tokenName, address account) public view returns (uint) {
    return tokenInstanceMap[tokenName].balanceOf(account);
  }

  function getName(string memory tokenName) public view returns (string memory) {
    return tokenInstanceMap[tokenName].name();
  }

  function getTokenAddress(string memory tokenName) public view returns (address) {
    return address(tokenInstanceMap[tokenName]);
  }

  function swapEthToToken(string memory tokenName, uint amount) public payable nonReentrant returns (uint) {
    uint outputValue = (amount * ethValue) / 10 ** 18;

    require(tokenInstanceMap[tokenName].transfer(msg.sender, outputValue), 'swapEthToToken: transfer failed');

    emit SwapEthToToken(msg.sender, tokenName, amount, outputValue);

    return outputValue;
  }

  function swapTokenToEth(string memory tokenName, uint amount) public nonReentrant returns (uint) {
    uint exactAmount = (amount * ethValue) / 10 ** 18;
    require(address(this).balance >= exactAmount, 'swapTokenToEth: dex is running low on balance');
    require(tokenInstanceMap[tokenName].transferFrom(msg.sender, address(this), amount));

    payable(msg.sender).transfer(exactAmount);
    emit SwapTokenToEth(msg.sender, tokenName, amount, exactAmount);
    return exactAmount;
  }

  function swapTokenToToken(string memory srcTokenName, string memory destTokenName, uint _amount) public nonReentrant {
    require(
      tokenInstanceMap[srcTokenName].transferFrom(msg.sender, address(this), _amount),
      'swapTokenToToken: transferFrom failed'
    );
    require(tokenInstanceMap[destTokenName].transfer(msg.sender, _amount), 'swapTokenToToken: transferTo failed');

    emit SwapTokenToToken(msg.sender, srcTokenName, destTokenName, _amount);
  }

  function getEthBalance() public view returns (uint) {
    return address(this).balance;
  }

  function checkAllowance(string memory tokenName, address user) public view returns (uint256) {
    CustomToken token = tokenInstanceMap[tokenName];
    return token.allowance(user, address(this));
  }
}
