import { ethers } from 'ethers'
import * as uniswapJson from '../artifacts/contracts/Uniswap.sol/Uniswap.json'

async function main() {
  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.API_URL)

  // Your account private key
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    throw new Error('Please set your PRIVATE_KEY in the environment variables')
  }

  // Create a signer
  const signer = new ethers.Wallet(privateKey, provider)

  // Create a contract factory
  const Uniswap = new ethers.ContractFactory(uniswapJson.abi, uniswapJson.bytecode, signer)

  // Deploy the contract
  const uniswap_deploy = await Uniswap.deploy()

  // Wait for the contract to be mined
  await uniswap_deploy.waitForDeployment()

  console.log('Contract Deployed to Address:', await uniswap_deploy.getAddress())
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
