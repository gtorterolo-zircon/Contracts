const MIXR = artifacts.require('./MIXR.sol');
const FixidityLibMock = artifacts.require('./FixidityLibMock.sol');
const SampleERC20 = artifacts.require('./test/SampleERC20.sol');
const SampleOtherERC20 = artifacts.require('./test/SampleOtherERC20.sol');

const BigNumber = require('bignumber.js');
const chai = require('chai');

// use default BigNumber
chai.use(require('chai-bignumber')()).should();

contract('Fees', (accounts) => {
    let mixr;
    let fixidityLibMock;
    let someERC20;
    let someOtherERC20;
    const owner = accounts[0];
    const governor = accounts[1];
    const user = accounts[2];
    // eslint-disable-next-line camelcase
    let fixed_1;
    // eslint-disable-next-line camelcase
    let max_fixed_add;

    before(async () => {
        mixr = await MIXR.deployed();
        fixidityLibMock = await FixidityLibMock.deployed();
        someERC20 = await SampleERC20.deployed();
        someOtherERC20 = await SampleOtherERC20.deployed();
        // eslint-disable-next-line camelcase
        fixed_1 = new BigNumber(await fixidityLibMock.fixed_1());
        // eslint-disable-next-line camelcase
        max_fixed_add = new BigNumber(await fixidityLibMock.max_fixed_add());
    });

    describe('proportion after deposit functionality', () => {
        beforeEach(async () => {
            const amountToUser = new BigNumber(10).pow(18).multipliedBy(80);
            mixr = await MIXR.new();
            await mixr.addGovernor(governor, {
                from: owner,
            });

            /**
             * We will simulate that there's already some other token in the basket and we will
             * deposit a new one.
             */
            someERC20 = await SampleERC20.new(governor,
                new BigNumber(10).pow(18).multipliedBy(100).toString(10),
                18);
            await mixr.approveToken(someERC20.address, {
                from: governor,
            });
            await someERC20.transfer(user, amountToUser.toString(10), { from: governor });

            /**
             * token to deposit
             */
            someOtherERC20 = await SampleOtherERC20.new(governor,
                new BigNumber(10).pow(18).multipliedBy(100).toString(10),
                18);
            await mixr.approveToken(someOtherERC20.address, {
                from: governor,
            });

            await mixr.setTokensTargetProportion(
                [
                    someERC20.address,
                    someOtherERC20.address,
                ],
                [
                    new BigNumber(await fixidityLibMock.newFixedFraction(1, 2)).toString(10),
                    new BigNumber(await fixidityLibMock.newFixedFraction(1, 2)).toString(10),
                ],
                {
                    from: governor,
                },
            );
            await someOtherERC20.transfer(user, amountToUser.toString(10), { from: governor });
        });
        it('proportionAfterDeposit(token,1) with an empty basket', async () => {
            const result = new BigNumber(
                await mixr.proportionAfterDeposit(
                    someERC20.address,
                    1,
                ),
            );
            result.should.be.bignumber
                .equal(new BigNumber(fixed_1));
        });
        it('proportionAfterDeposit(x,1) with one wei of x already in the basket', async () => {
            await someERC20.transfer(mixr.address, 1, {
                from: governor,
            });
            const result = new BigNumber(
                await mixr.proportionAfterDeposit(
                    someERC20.address,
                    1,
                ),
            );
            result.should.be.bignumber
                .equal(new BigNumber(fixed_1));
        });
        it('proportionAfterDeposit(y,1) with one wei of x', async () => {
            await someERC20.transfer(mixr.address, 1, {
                from: governor,
            });
            const result = new BigNumber(
                await mixr.proportionAfterDeposit(
                    someOtherERC20.address,
                    1,
                ),
            );
            result.should.be.bignumber
                .equal(new BigNumber(fixed_1).dividedBy(2));
        });
        it('proportionAfterDeposit(token,100 tokens) with an empty basket', async () => {
            const amountTokens = new BigNumber(10).pow(18).multipliedBy(100);
            const result = new BigNumber(
                await mixr.proportionAfterDeposit(
                    someERC20.address,
                    amountTokens.toString(10),
                ),
            );
            result.should.be.bignumber
                .equal(new BigNumber(fixed_1));
        });
        it('proportionAfterDeposit(token,1000000 tokens) with an empty basket', async () => {
            const amountTokens = new BigNumber(10).pow(24);
            const result = new BigNumber(
                await mixr.proportionAfterDeposit(
                    someERC20.address,
                    amountTokens.toString(10),
                ),
            );
            result.should.be.bignumber
                .equal(new BigNumber(fixed_1));
        });
        it('proportionAfterDeposit(token,1000000000000 tokens) with an empty basket', async () => {
            const amountTokens = new BigNumber(10).pow(30);
            const result = new BigNumber(
                await mixr.proportionAfterDeposit(
                    someERC20.address,
                    amountTokens.toString(10),
                ),
            );
            result.should.be.bignumber
                .equal(new BigNumber(fixed_1));
        });
    });

    describe('deviation after deposit functionality', () => {
        beforeEach(async () => {
            const amountToUser = new BigNumber(10).pow(18).multipliedBy(80);
            mixr = await MIXR.new();
            await mixr.addGovernor(governor, {
                from: owner,
            });

            /**
             * We will simulate that there's already some other token in the basket and we will
             * deposit a new one.
             */
            someERC20 = await SampleERC20.new(governor,
                new BigNumber(10).pow(18).multipliedBy(100).toString(10),
                18);
            await mixr.approveToken(someERC20.address, {
                from: governor,
            });
            someOtherERC20 = await SampleOtherERC20.new(governor,
                new BigNumber(10).pow(18).multipliedBy(100).toString(10),
                18);
            await mixr.approveToken(someOtherERC20.address, {
                from: governor,
            });

            await mixr.setTokensTargetProportion(
                [someERC20.address],
                [fixed_1.toString(10)],
                {
                    from: governor,
                },
            );
            await someERC20.transfer(user, amountToUser.toString(10), { from: governor });
            await someOtherERC20.transfer(user, amountToUser.toString(10), { from: governor });
        });

        it('deviationAfterDeposit(x,1) with empty basket', async () => {
            const result = new BigNumber(
                await mixr.deviationAfterDeposit(someERC20.address, 1),
            );
            result.should.be.bignumber.equal(0);
        });

        it('deviationAfterDeposit(x,1) after introducing 1 token y', async () => {
            const amountToTransfer = new BigNumber(10).pow(18);
            await someOtherERC20.transfer(
                mixr.address,
                amountToTransfer.toString(10),
                { from: governor },
            );
            const result = new BigNumber(
                await mixr.deviationAfterDeposit(someERC20.address, amountToTransfer.toString(10)),
            );
            result.should.be.bignumber.equal(fixed_1.dividedBy(-2).dp(0, 1));
        });

        it('deviationAfterDeposit(x,1) after setting token x targetProportion to zero', async () => {
            await mixr.setTokensTargetProportion(
                [
                    someERC20.address,
                    someOtherERC20.address,
                ],
                [
                    0,
                    fixed_1.toString(10),
                ],
                {
                    from: governor,
                },
            );
            const amountToTransfer = new BigNumber(10).pow(18);
            await someOtherERC20.transfer(
                mixr.address,
                amountToTransfer.toString(10),
                { from: governor },
            );
            const result = new BigNumber(
                await mixr.deviationAfterDeposit(someERC20.address, amountToTransfer.toString(10)),
            );
            result.should.be.bignumber.equal(fixed_1.dividedBy(2).dp(0, 1));
        });
    });

    describe('deposit fee calculation functionality', () => {
        beforeEach(async () => {
            mixr = await MIXR.new();
            await mixr.addGovernor(governor, {
                from: owner,
            });

            /**
             * We will simulate that there's already some other token in the basket and we will
             * deposit a new one.
             */
            someERC20 = await SampleERC20.new(governor,
                new BigNumber(10).pow(18).multipliedBy(100).toString(10),
                18);
            await mixr.approveToken(someERC20.address, {
                from: governor,
            });
            someOtherERC20 = await SampleOtherERC20.new(governor,
                new BigNumber(10).pow(18).multipliedBy(100).toString(10),
                18);
            await mixr.approveToken(someOtherERC20.address, {
                from: governor,
            });

            /* await mixr.setTokenTargetProportion(
                someERC20.address,
                fixed_1.dividedBy(2).toString(10),
                {
                    from: governor,
                },
            );
            await mixr.setTokenTargetProportion(
                someOtherERC20.address,
                fixed_1.dividedBy(2).toString(10),
                {
                    from: governor,
                },
            ); */

            const amountToUser = new BigNumber(10).pow(18).multipliedBy(90);
            await someERC20.transfer(user, amountToUser.toString(10), { from: governor });
            await someOtherERC20.transfer(user, amountToUser.toString(10), { from: governor });
        });
        /*
        * Test deviation = -0.4, proportion = 0.5, base = fixed_1()/10
        *      proportionAfterDeposit = 0.1, proportion = 0.5
        *      Set proportion to 0.5 for token x. Set basket to contain just 90 tokens of token y. Call depositFee(x,10);
        * Test deviation = -0.39, proportion = 0.5, base = fixed_1()/10
        *      proportionAfterDeposit = 0.11, proportion = 0.5
        *      Set proportion to 0.5 for token x. Set basket to contain just 89 tokens of token y. Call depositFee(x,11);
        * Test deviation = 0.39, proportion = 0.5, base = fixed_1()/10
        *      proportionAfterDeposit = 0.89, proportion = 0.5
        *      Set proportion to 0.5 for token x. Set basket to contain just 11 tokens of token y. Call depositFee(x,89);
        * Test deviation = 0.4, proportion = 0.5, base = fixed_1()/10
        *      proportionAfterDeposit = 0.9, proportion = 0.5
        *      Set proportion to 0.5 for token x. Set basket to contain just 10 tokens of token y. Call depositFee(x,90);
        */
        /* it('depositFee(x,90) with 10 y in basket', async () => {
            const amountInBasket = new BigNumber(10).pow(18).multipliedBy(10);
            const amountToTransfer = new BigNumber(10).pow(18).multipliedBy(90);
            await someOtherERC20.transfer(mixr.address, amountInBasket, { from: governor });
            const result = new BigNumber(
                await mixr.depositFee(someERC20.address, amountToTransfer.toString(10)),
            );
            result.should.be.bignumber.equal(fixed_1).dividedBy(10**6);
        });

        it('depositFee(x,89) with 11 y in basket', async () => {
            const amountInBasket = new BigNumber(10).pow(18).multipliedBy(11);
            const amountToTransfer = new BigNumber(10).pow(18).multipliedBy(89);
            await someOtherERC20.transfer(mixr.address, amountInBasket.toString(10), { from: governor });
            const result = new BigNumber(
                await mixr.depositFee(someERC20.address, amountToTransfer.toString(10)),
            );
            result.should.be.bignumber.equal(fixed_1).dividedBy(10**6);
        });

        it('depositFee(x,11) with 89 y in basket', async () => {
            const amountInBasket = new BigNumber(10).pow(18).multipliedBy(89);
            const amountToTransfer = new BigNumber(10).pow(18).multipliedBy(11);
            await someOtherERC20.transfer(mixr.address, amountInBasket.toString(10), { from: governor });
            const result = new BigNumber(
                await mixr.depositFee(someERC20.address, amountToTransfer.toString(10)),
            );
            result.should.be.bignumber.equal(fixed_1).dividedBy(10**6);
        });

        it('depositFee(x,10) with 90 y in basket', async () => {
            const amountInBasket = new BigNumber(10).pow(18).multipliedBy(90);
            const amountToTransfer = new BigNumber(10).pow(18).multipliedBy(10);
            await someOtherERC20.transfer(mixr.address, amountInBasket.toString(10), { from: governor });
            const result = new BigNumber(
                await mixr.depositFee(someERC20.address, amountToTransfer.toString(10)),
            );
            result.should.be.bignumber.equal(fixed_1).dividedBy(10**6);
        }); */
    });
});
