const { ethers } = require("ethers");

const { abi: QuoterV2ABI } = require('@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json')
const { abi: PoolABI } = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json')
const { abi: FactoryABI } = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json")

const ERC20ABI = require('./abi/erc20.json')
const WETHABI = require('./abi/weth.json');

const QUOTER2_ADDRESS = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

const INFURA_ID = 'INFURA_ID' 
const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${INFURA_ID}`)

const getAbi = address => address === WETH_ADDRESS ? WETHABI : ERC20ABI

function sqrtToPrice(sqrt, decimals0, decimals1, token0IsInput = true){
    const numerator = sqrt ** 2
    const denominator = 2 ** 192
    let ratio = numerator / denominator
    const shiftDecimals = Math.pow( 10, decimals0 - decimals1 )
    ratio = ratio * shiftDecimals
    if(!token0IsInput){
        ratio = 1 / ratio
    }
    return ratio
}

async function main(tokenIn, tokenOut, fee, amountIn){
    const factory = new ethers.Contract(
        FACTORY_ADDRESS, 
        FactoryABI, 
        provider
    )

    const poolAddress = factory.getPool(tokenIn, tokenOut, fee)
    const poolContract = new ethers.Contract(
        poolAddress,
        PoolABI,
        provider,
    )

    const slot0 = await poolContract.slot0()
    const sqrtPriceX96 = slot0.sqrtPriceX96

    const token0 = await poolContract.token0()
    const token1 = await poolContract.token1()

    const token0IsInput = tokenIn === token0

    const tokenInAbi = getAbi(tokenIn)
    const tokenOutAbi = getAbi(tokenOut)

    const tokenInContract = new ethers.Contract(tokenIn, tokenInAbi, provider)
    const tokenOutContract = new ethers.Contract(tokenOut, tokenOutAbi, provider)

    const decimalsIn = await tokenInContract.decimals()
    const decimalsOut = await tokenOutContract.decimals()

    const quoter = new ethers.Contract(
        QUOTER2_ADDRESS,
        QuoterV2ABI,
        provider,
    )

    const params = {
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: fee,
        amountIn: amountIn,
        sqrtPriceLimitX96: '0',
    }

    const quote = await quoter.callStatic.quoteExactInputSingle(params)

    const sqrtPriceX96After = quote.sqrtPriceX96After

    const price = sqrtToPrice(sqrtPriceX96, decimalsIn, decimalsOut, token0IsInput)
    const priceAfter = sqrtToPrice(sqrtPriceX96After, decimalsIn, decimalsOut, token0IsInput)

    console.log('price', price)
    console.log('priceAfter', priceAfter)

    const absoluteChange = price - priceAfter
    const percentChange = absoluteChange / price
    console.log('percent change', (percentChange * 100).toFixed(3), '%')
}

main(
    WETH_ADDRESS,
    USDC_ADDRESS,
    '3000',
    ethers.utils.parseEther('100')
)
