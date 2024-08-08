const { buildModule } = require('@nomicfoundation/hardhat-ignition/modules')

const UniswapModule = buildModule('UniswapModule', (m) => {
  const uniswap = m.contract('Uniswap')

  return { uniswap }
})

module.exports = UniswapModule
