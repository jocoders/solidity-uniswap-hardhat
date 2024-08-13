import { loadFixture } from '@nomicfoundation/hardhat-toolbox-viem/network-helpers'
import { expect } from 'chai'
import hre from 'hardhat'
import { getAddress, parseEther, encodeFunctionData } from 'viem'

describe('Uniswap', function () {
  async function deployFixture() {
    const [owner, otherAccount] = await hre.viem.getWalletClients()
    const contract = await hre.viem.deployContract('Uniswap', [])
    const publicClient = await hre.viem.getPublicClient()

    return { contract, owner, otherAcc: otherAccount, publicClient }
  }

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      const { contract, owner } = await loadFixture(deployFixture)
      expect(await contract.read.owner()).to.equal(getAddress(owner.account.address))
    })

    it('Should initialize ERC20 tokens correctly', async function () {
      const { contract } = await loadFixture(deployFixture)
      const tokens = ['GAL', 'JOC', 'WETH']

      for (const tokenName of tokens) {
        const tokenAddress = await contract.read.getTokenAddress([tokenName])
        const tokenContract = await hre.viem.getContractAt('CustomToken', tokenAddress)

        const name = await tokenContract.read.name()
        expect(name).to.equal(tokenName)

        const symbol = await tokenContract.read.symbol()
        expect(symbol).to.equal(tokenName)

        const totalSupply = await tokenContract.read.totalSupply()
        expect(totalSupply).to.equal(parseEther('100000'))
      }
    })

    describe('Token Management', function () {
      it('Should return the correct token balance', async function () {
        const { contract, otherAcc } = await loadFixture(deployFixture)
        const tokenName = 'GAL'

        const galTokenAddress = await contract.read.getTokenAddress([tokenName])
        const galTokenContract = await hre.viem.getContractAt('CustomToken', galTokenAddress)

        const uniswapInitBalance = await galTokenContract.read.balanceOf([contract.address])
        expect(Number(uniswapInitBalance)).to.be.gt(Number(0))

        const otherAccountInitGalBalance = await galTokenContract.read.balanceOf([otherAcc.account.address])
        expect(otherAccountInitGalBalance).to.equal(0n)

        const uniswapReportedBalance = await contract.read.getBalance([tokenName, contract.address])
        expect(uniswapReportedBalance).to.equal(uniswapInitBalance)
      })

      it('Should return the correct token name', async function () {
        const { contract } = await loadFixture(deployFixture)
        const name = await contract.read.getName(['GAL'])
        expect(name).to.equal('GAL')
      })

      it('Should return the correct token address', async function () {
        const { contract } = await loadFixture(deployFixture)
        const tokenName = 'GAL'
        const tokenAddress = await contract.read.getTokenAddress([tokenName])
        const expectedTokenAddress = await contract.read.tokenInstanceMap([tokenName])

        expect(tokenAddress).to.equal(expectedTokenAddress)
      })
    })

    describe('Swaps', function () {
      it('Should swap ETH to GAL tokens and GAL tokens to ETH', async function () {
        const { contract, otherAcc, publicClient } = await loadFixture(deployFixture)
        const swapEthAmount = parseEther('1')
        const tokenName = 'GAL'

        const galTokenAddress = await contract.read.getTokenAddress([tokenName])
        const galTokenContract = await hre.viem.getContractAt('CustomToken', galTokenAddress)
        const galTokenInitBalance = await galTokenContract.read.balanceOf([contract.address])

        const otherAccInitEthBalance = await publicClient.getBalance({ address: otherAcc.account.address })
        const otherAccountGalInitBalance = await galTokenContract.read.balanceOf([otherAcc.account.address])

        const swapEthToTokenData = encodeFunctionData({
          abi: contract.abi,
          functionName: 'swapEthToToken',
          args: [tokenName]
        })

        const txHash = await otherAcc.sendTransaction({
          to: contract.address,
          value: swapEthAmount,
          data: swapEthToTokenData
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

        const otherAccFinalEthBalance = await publicClient.getBalance({ address: otherAcc.account.address })
        const otherAccFinalGalBalance = await galTokenContract.read.balanceOf([otherAcc.account.address])

        const gasUsed = BigInt(receipt.gasUsed)
        const gasPrice = BigInt(receipt.effectiveGasPrice)
        const gasCost = gasUsed * gasPrice

        expect(otherAccFinalEthBalance).to.equal(otherAccInitEthBalance - swapEthAmount - gasCost)
        expect(Number(otherAccFinalGalBalance)).to.be.greaterThan(Number(otherAccountGalInitBalance))

        const contractGalTokenBalance = await galTokenContract.read.balanceOf([contract.address])
        expect(Number(contractGalTokenBalance)).to.be.eq(Number(galTokenInitBalance - otherAccFinalGalBalance))

        const galToSwapBack = otherAccFinalGalBalance / 2n

        await galTokenContract.write.approve([contract.address, galToSwapBack], { account: otherAcc.account })
        await contract.write.swapTokenToEth([tokenName, galToSwapBack], { account: otherAcc.account })

        const otherAccFinalEthBalance2 = await publicClient.getBalance({ address: otherAcc.account.address })
        const otherAccFinalGalBalance2 = await galTokenContract.read.balanceOf([otherAcc.account.address])

        expect(otherAccFinalGalBalance2).to.be.eq(galToSwapBack)
        expect(Number(otherAccFinalEthBalance2)).to.be.greaterThan(Number(otherAccFinalEthBalance))

        const finalContractGalTokenBalance = await galTokenContract.read.balanceOf([contract.address])
        expect(finalContractGalTokenBalance).to.be.eq(contractGalTokenBalance + galToSwapBack)
      })
      it('Should swap one token for another', async function () {
        const { contract, otherAcc, publicClient } = await loadFixture(deployFixture)
        const swapEthAmount = parseEther('1')
        const galTokenName = 'GAL'
        const jocTokenName = 'JOC'

        const galAddress = await contract.read.getTokenAddress([galTokenName])
        const jocAddress = await contract.read.getTokenAddress([jocTokenName])

        const galTokenContract = await hre.viem.getContractAt('CustomToken', galAddress)
        const jocTokenContract = await hre.viem.getContractAt('CustomToken', jocAddress)

        const contractJocInitBalance = await jocTokenContract.read.balanceOf([contract.address])

        const swapEthToTokenData = encodeFunctionData({
          abi: contract.abi,
          functionName: 'swapEthToToken',
          args: [galTokenName]
        })

        const txHash = await otherAcc.sendTransaction({
          to: contract.address,
          value: swapEthAmount,
          data: swapEthToTokenData
        })

        await publicClient.waitForTransactionReceipt({ hash: txHash })

        const otherAccGalBalance = await galTokenContract.read.balanceOf([otherAcc.account.address])
        const otherAccJocInitBalance = await jocTokenContract.read.balanceOf([otherAcc.account.address])

        const swapGalAmount = otherAccGalBalance / 2n

        await galTokenContract.write.approve([contract.address, swapGalAmount], { account: otherAcc.account })

        const galAllowance = await galTokenContract.read.allowance([otherAcc.account.address, contract.address])
        expect(Number(galAllowance)).to.be.at.least(Number(swapGalAmount))

        await contract.write.swapTokenToToken([galTokenName, jocTokenName, swapGalAmount], {
          account: otherAcc.account
        })

        const otherAccFinalGalBalance = await galTokenContract.read.balanceOf([otherAcc.account.address])
        const otherAccFinalJocBalance = await jocTokenContract.read.balanceOf([otherAcc.account.address])
        const contractJocFinalBalance = await jocTokenContract.read.balanceOf([contract.address])

        expect(Number(otherAccFinalGalBalance)).to.be.eq(Number(swapGalAmount))
        expect(Number(otherAccFinalJocBalance)).to.be.greaterThan(Number(otherAccJocInitBalance))
        expect(Number(contractJocFinalBalance)).to.be.eq(Number(contractJocInitBalance - otherAccFinalJocBalance))
      })
    })
  })
})
