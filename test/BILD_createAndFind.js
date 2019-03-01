const BILD = artifacts.require('./BILD.sol');

const BigNumber = require('bignumber.js');
const chai = require('chai');
const { itShouldThrow, tokenNumber } = require('./utils');
// use default BigNumber
chai.use(require('chai-bignumber')()).should();

contract('BILD', (accounts) => {
    let bild;
    const bildDecimals = 18;
    const distributor = accounts[1];
    const stakeholder1 = accounts[2];
    const stakeholder2 = accounts[3];
    const stakeholder3 = accounts[4];
    const agent1 = accounts[5];
    const agent2 = accounts[6];
    const agent3 = accounts[7];
    let oneBILDToken;
    let twoBILDTokens;
    let manyBILDTokens;
    let minimumStake;
    let NO_STAKES;

    before(async () => {
        bild = await BILD.deployed();
        oneBILDToken = tokenNumber(bildDecimals, 1);
        twoBILDTokens = tokenNumber(bildDecimals, 2);
        manyBILDTokens = tokenNumber(bildDecimals, 100);
        minimumStake = oneBILDToken;
        NO_STAKES = new BigNumber(115792089237316195423570985008687907853269984665640564039457584007913129639935);
    });

    describe('nominateAgent', () => {
        beforeEach(async () => {
            bild = await BILD.new(distributor);
        });
        /*
         * Test nominateAgent(_agent, minimumStake - 1) fails - "Minimum stake to nominate an agent not reached."
         */
        itShouldThrow(
            'nominateAgent fails with stake under minimum stake.',
            async () => {
                await bild.transfer(
                    stakeholder1,
                    minimumStake,
                    { from: distributor },
                );

                await bild.nominateAgent(
                    agent1,
                    1,
                    {
                        from: stakeholder1,
                    },
                );
            },
            'Minimum stake to nominate an agent not reached.',
        );
    });

    describe('createStake', () => {
        beforeEach(async () => {
            bild = await BILD.new(distributor);
            await bild.transfer(
                stakeholder1,
                manyBILDTokens,
                { from: distributor },
            );
            await bild.nominateAgent(
                agent1,
                minimumStake,
                {
                    from: stakeholder1,
                },
            );
        });
        /*
         * Test createStake(_agent, 1) fails with no BILD - "Attempted stake larger than BILD balance."
         * Test createStake(_agent, 2) fails with 1 BILD wei - "Attempted stake larger than BILD balance."
         * Test createStake(_agent, 1) fails with 1 BILD wei - "Minimum stake to nominate an agent not reached."
         * Test createStake(_agent, 1 token) with 1 BILD token executes and findStakeIndex(_agent, _stakeholder) returns 0.
         * Execute:
         *     stakeholder1: createStake(agent3, 1 token)
         *     stakeholder2: createStake(agent3, 1 wei)
         * Test findStakeValue(agent3, stakeholder2) returns 1 wei.
         */
        itShouldThrow(
            'createStake fails with no BILD balance',
            async () => {
                await bild.createStake(
                    agent1,
                    minimumStake,
                    {
                        from: stakeholder2,
                    },
                );
            },
            'Attempted stake larger than BILD balance.',
        );
        itShouldThrow(
            'createStake fails with stake larger than balance',
            async () => {
                await bild.transfer(
                    stakeholder2,
                    oneBILDToken,
                    {
                        from: distributor,
                    },
                );
                
                await bild.createStake(
                    agent1,
                    twoBILDTokens,
                    {
                        from: stakeholder2,
                    },
                );
            },
            'Attempted stake larger than BILD balance.',
        );
        it('createStake with 1 BILD token executes', async () => {
            await bild.transfer(
                stakeholder2,
                oneBILDToken,
                { from: distributor },
            );
            
            await bild.createStake(
                agent1,
                oneBILDToken,
                {
                    from: stakeholder2,
                },
            );

            const createdStake = new BigNumber(
                await bild.findStakeValue(
                    agent1,
                    stakeholder2,
                    {
                        from: stakeholder2,
                    },
                ),
            );
            createdStake.should.be.bignumber.equal(oneBILDToken);
        });
        it('stakes with the same agent and stakeholder merge.', async () => {
            await bild.transfer(
                stakeholder2,
                twoBILDTokens,
                { from: distributor },
            );
            
            await bild.createStake(
                agent1,
                oneBILDToken,
                {
                    from: stakeholder2,
                },
            );

            await bild.createStake(
                agent1,
                oneBILDToken,
                {
                    from: stakeholder2,
                },
            );

            const createdStake = new BigNumber(
                await bild.findStakeValue(
                    agent1,
                    stakeholder2,
                    {
                        from: stakeholder2,
                    },
                ),
            );
            createdStake.should.be.bignumber.equal(twoBILDTokens);
        });
        it('stakes under minimum stake are allowed for already nominated agents.', async () => {
            await bild.transfer(
                stakeholder2,
                oneBILDToken,
                { from: distributor },
            );
            
            await bild.nominateAgent(
                agent3,
                oneBILDToken,
                {
                    from: stakeholder1,
                },
            );

            await bild.createStake(
                agent3,
                1,
                {
                    from: stakeholder2,
                },
            );

            const createdStake = new BigNumber(
                await bild.findStakeValue(
                    agent3,
                    stakeholder2,
                    {
                        from: stakeholder2,
                    },
                ),
            );
            createdStake.should.be.bignumber.equal(1);
        });
    });
    /*
    * Test findStakeIndex(agent3, stakeholder1) fails - "Agent not found."
    * Execute:
    * stakeholder1: createStake(agent1, 1 token)
    * stakeholder2: createStake(agent1, 2 token)
    * stakeholder1: createStake(agent2, 2 token)
    * Test findStakeIndex(agent1, stakeholder1) returns 0.
    * Test findStakeIndex(agent1, stakeholder2) returns 1.
    * Test findStakeIndex(agent2, stakeholder1) returns 0.
    * Test findStakeIndex(agent1, stakeholder3) returns 2.
    * Test findStakeValue(agent1, stakeholder1) returns 1 token.
    * Test findStakeValue(agent2, stakeholder1) returns 2 token.
    */
    describe('findStake*', () => {
        beforeEach(async () => {
            bild = await BILD.new(distributor);

            await bild.transfer(
                stakeholder1,
                manyBILDTokens,
                { from: distributor },
            );

            await bild.transfer(
                stakeholder2,
                manyBILDTokens,
                { from: distributor },
            );

            await bild.nominateAgent(
                agent1,
                oneBILDToken,
                {
                    from: stakeholder1,
                },
            );

            await bild.createStake(
                agent1,
                twoBILDTokens,
                {
                    from: stakeholder2,
                },
            );

            await bild.nominateAgent(
                agent2,
                twoBILDTokens,
                {
                    from: stakeholder1,
                },
            );
        });
        itShouldThrow(
            'findStakeIndex fails if passed a non nominated agent.',
            async () => {
                await bild.findStakeIndex(
                    agent3,
                    stakeholder1,
                    {
                        from: stakeholder1,
                    },
                );
            },
            'Agent not found.',
        );
        it('findStakeIndex returns stake index for first agent and first stakeholder.', async () => {
            const createdStakeIndex = new BigNumber(
                await bild.findStakeIndex(
                    agent1,
                    stakeholder1,
                    {
                        from: stakeholder1,
                    },
                ),
            );
            createdStakeIndex.should.be.bignumber.equal(0);
        });
        it('findStakeIndex returns stake index for first agent and second stakeholder.', async () => {
            const createdStakeIndex = new BigNumber(
                await bild.findStakeIndex(
                    agent1,
                    stakeholder2,
                    {
                        from: stakeholder2,
                    },
                ),
            );
            createdStakeIndex.should.be.bignumber.equal(1);
        });
        it('findStakeIndex returns stake index for second agent and first stakeholder.', async () => {
            const createdStakeIndex = new BigNumber(
                await bild.findStakeIndex(
                    agent2,
                    stakeholder1,
                    {
                        from: stakeholder1,
                    },
                ),
            );
            createdStakeIndex.should.be.bignumber.equal(0);
        });
        it('findStakeIndex returns bild.NO_STAKES for stakeholders without stakes.', async () => {
            const createdStakeIndex = new BigNumber(
                await bild.findStakeIndex(
                    agent1,
                    stakeholder3,
                    {
                        from: stakeholder1,
                    },
                ),
            );
            createdStakeIndex.should.be.bignumber.equal(NO_STAKES);
        });
        itShouldThrow(
            'findStakeValue fails if passed a non nominated agent.',
            async () => {
                await bild.findStakeIndex(
                    agent3,
                    stakeholder1,
                    {
                        from: stakeholder1,
                    },
                );
            },
            'Agent not found.',
        );
        it('findStakeValue returns stake value for first agent and first stakeholder.', async () => {
            const createdStakeValue = new BigNumber(
                await bild.findStakeValue(
                    agent1,
                    stakeholder1,
                    {
                        from: stakeholder1,
                    },
                ),
            );
            createdStakeValue.should.be.bignumber.equal(oneBILDToken);
        });
        it('findStakeValue returns stake index for second agent and first stakeholder.', async () => {
            const createdStakeValue = new BigNumber(
                await bild.findStakeValue(
                    agent2,
                    stakeholder1,
                    {
                        from: stakeholder1,
                    },
                ),
            );
            createdStakeValue.should.be.bignumber.equal(twoBILDTokens);
        });
    });
});
