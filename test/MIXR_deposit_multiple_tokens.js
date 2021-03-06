const MIXR = artifacts.require('./MIXR.sol');
const Whitelist = artifacts.require('./Whitelist.sol');
const Fees = artifacts.require('./Fees.sol');
const FixidityLibMock = artifacts.require('./FixidityLibMock.sol');
const SampleDetailedERC20 = artifacts.require('./test/SampleDetailedERC20.sol');
const SamplePlainERC20 = artifacts.require('./test/SamplePlainERC20.sol');
const SampleERC721 = artifacts.require('./test/SampleERC721.sol');
const BigNumber = require('bignumber.js');
const chai = require('chai');
const { itShouldThrow, tokenNumber } = require('./utils');
// use default BigNumber
chai.use(require('chai-bignumber')()).should();

/**
 * Method to test deposit functionality
 * @param {BigNumber} tokens amount in tokens to be redeem
 * @param {String} user user address doing redemption
 * @param {String} stakeholders wallet address were fees are being sent
 * @param {Object} sampleDetailedERC20 erc20 contract
 * @param {Integer} sampleERC20Decimals erc20 decimals
 * @param {Object} mixr mixr contract
 * @param {Integer} mixrDecimals mixr decimals
 */
const depositTest = async (
    tokens, user, stakeholders, sampleDetailedERC20, sampleERC20Decimals, mixr, mixrDecimals, DEPOSIT) => {
    /**
     * get previous balances
     */
    const previousERC20Balance = new BigNumber(
        await sampleDetailedERC20.balanceOf(user),
    );
    const previousMixrBalance = new BigNumber(await mixr.balanceOf(user));
    /**
     * define amounts
     */
    const depositInERC20Wei = new BigNumber(tokenNumber(sampleERC20Decimals, tokens));
    const depositInMIXWei = new BigNumber(tokenNumber(mixrDecimals, tokens));
    /**
     * The deposit fee should be 0.1
     */
    const depositFee = 0.1;
    const depositFeeWei = depositInMIXWei.multipliedBy(depositFee);

    /**
     * approve and deposit
     */
    await sampleDetailedERC20.approve(mixr.address, depositInERC20Wei.toString(10), {
        from: user,
    });
    await mixr.depositToken(sampleDetailedERC20.address, depositInERC20Wei.toString(10), {
        from: user,
    });
    /**
     * asserts - verify balances
     */
    // User spends the stablecoin
    new BigNumber(await sampleDetailedERC20.balanceOf(user)).should.be.bignumber.equal(
        previousERC20Balance.minus(depositInERC20Wei),
    );
    // User receives the MIX minus the fee
    new BigNumber(await mixr.balanceOf(user)).should.be.bignumber.equal(
        previousMixrBalance.plus(depositInMIXWei.minus(depositFeeWei)),
    );
    // The stakeholder account should get the fees
    new BigNumber(await mixr.balanceOf(stakeholders))
        .should.be.bignumber.equal(depositFeeWei);

    // Since basket was empty, it should be exactly equal to the deposit
    depositInERC20Wei.should.be.bignumber.equal(
        new BigNumber(await sampleDetailedERC20.balanceOf(mixr.address)),
    );
};

contract('MIXR many tokens', (accounts) => {
    let mixr;
    let whitelist;
    let fees;
    let fixidityLibMock;
    let sampleDetailedERC20s;
    let sampleDetailedERC20Other;
    let someERC721;
    const sampleERC20Decimals = 18;
    const mixrDecimals = 24;
    const owner = accounts[0];
    const governor = accounts[1];
    const user = accounts[2];
    const stakeholders = accounts[3];
    const user2 = accounts[4];
    let fixed1;
    let DEPOSIT;
    let REDEMPTION;

    before(async () => {
        mixr = await MIXR.deployed();
        whitelist = await Whitelist.deployed();
        fees = await Fees.deployed();
        fixidityLibMock = await FixidityLibMock.deployed();
        sampleDetailedERC20 = await SampleDetailedERC20.deployed();
        samplePlainERC20 = await SamplePlainERC20.deployed();
        someERC721 = await SampleERC721.deployed();
        fixed1 = new BigNumber(await fixidityLibMock.fixed1());
        DEPOSIT = await fees.DEPOSIT();
        REDEMPTION = await fees.REDEMPTION();
    });

    describe('deposit functionality', () => {
        beforeEach(async () => {
            /**
             * deploy mixr and sample erc20
             */
            whitelist = await Whitelist.new();
            mixr = await MIXR.new(whitelist.address, fees.address);
            await whitelist.addGovernor(governor, {
                from: owner,
            });

            const ERC20TotalSupply = 100;

            const TOKEN_QUANTITY = 4;
            sampleDetailedERC20s = await Promise.all(new Array(TOKEN_QUANTITY).fill(null).map(
                async (aux, ii) => {
                    const sampleDetailedERC20 = await SampleDetailedERC20.new(
                        governor,
                        tokenNumber(sampleERC20Decimals, ERC20TotalSupply),
                        sampleERC20Decimals,
                        `SAMPLE${ii}`,
                        `SMP${ii}`,
                    );
                    await mixr.registerDetailedToken(sampleDetailedERC20.address, {
                        from: governor,
                    });
                    await sampleDetailedERC20.transfer(
                        user,
                        tokenNumber(sampleERC20Decimals, ERC20TotalSupply),
                        { from: governor },
                    );
                    return sampleDetailedERC20;
                }
            ));

            await mixr.setTokensTargetProportion(
                sampleDetailedERC20s.map(
                    (contract) => contract.address
                ),
                new Array(TOKEN_QUANTITY).fill(fixed1.dividedBy(TOKEN_QUANTITY).toString(10)),
                {
                    from: governor,
                },
            );
            /**
             * set base fee
             */
            const baseFee = new BigNumber(10).pow(23).toString(10);
            await mixr.setBaseFee(
                baseFee,
                DEPOSIT,
                {
                    from: governor,
                },
            );
            await mixr.setBaseFee(
                baseFee,
                REDEMPTION,
                {
                    from: governor,
                },
            );

            /**
             * set account to receive fees
             */
            await mixr.setBILDContract(stakeholders, { from: owner });

            /**
             * verify mixr balance is zero
             */
            const mixrBalance = new BigNumber(await mixr.totalSupply());
            assert.equal(mixrBalance.comparedTo(new BigNumber(0)), 0, 'should be 0.');
        });

        itShouldThrow(
            'forbids depositing without allowance',
            async () => {
                /**
                 * try to deposit without authorization
                 * should fail because it is not authorized yet.
                 */
                await mixr.depositToken(
                    sampleDetailedERC20s[0].address,
                    tokenNumber(sampleERC20Decimals, 1),
                    {
                        from: user2,
                    },
                );
            },
            'revert',
        );

        itShouldThrow(
            'forbids depositing a token that has not been registered first.',
            async () => {
                /**
                 * deploy new erc20 contract and try to deposit
                 * should fail because it is not accepted yet
                 */
                sampleDetailedERC20Other = await SampleDetailedERC20.new(
                    user,
                    tokenNumber(sampleERC20Decimals, 100),
                    sampleERC20Decimals,
                    'SAMPLE',
                    'SMP',
                );
                await mixr.depositToken(
                    sampleDetailedERC20Other.address,
                    tokenNumber(sampleERC20Decimals, 1),
                    {
                        from: user,
                    },
                );
            },
            'Token is not registered.',
        );

        itShouldThrow(
            'forbids depositing a token that has not been registered.',
            async () => {
                /**
                 * try to deposit an erc721 token
                 * should fail because it is not accepted yet
                 */
                await mixr.depositToken(
                    someERC721.address,
                    tokenNumber(sampleERC20Decimals, 100),
                    {
                        from: user,
                    },
                );
            },
            'Token is not registered.',
        );

        it('depositToken(50)', async () => {
            await depositTest(
                50, user, stakeholders, sampleDetailedERC20s[0], sampleERC20Decimals, mixr, mixrDecimals, DEPOSIT,
            );
        });

        it('depositToken(1)', async () => {
            await depositTest(
                1, user, stakeholders, sampleDetailedERC20s[0], sampleERC20Decimals, mixr, mixrDecimals, DEPOSIT,
            );
        });
    });
});
