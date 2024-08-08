import type { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox-viem'
import * as dotenv from 'dotenv'

dotenv.config()

const { API_URL, PRIVATE_KEY } = process.env

if (!API_URL || !PRIVATE_KEY) {
  throw new Error('API_URL or PRIVATE_KEY is not set')
}

const config: HardhatUserConfig = {
  solidity: '0.8.24',
  networks: {
    sepolia: {
      url: API_URL,
      accounts: [`0x${PRIVATE_KEY}`],
      gas: 8000000,
      gasPrice: 8000000000
    }
  }
}

export default config
