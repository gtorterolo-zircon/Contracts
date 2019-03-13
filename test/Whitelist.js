const Whitelist = artifacts.require('./Whitelist.sol');

const BigNumber = require('bignumber.js');
const chai = require('chai');
const { itShouldThrow, tokenNumber } = require('./utils');
// use default BigNumber
chai.use(require('chai-bignumber')()).should();

contract('BILD', (accounts) => {
    let bild;
    let bildDataTest;
    let whitelist;
    const bildDecimals = 18;
    const owner = accounts[0];
    const distributor = accounts[1];
    const governor = accounts[2];
    const stakeholder = accounts[3];
    const nonStakeholder = accounts[4];
    const agent1 = accounts[5];
    const agent2 = accounts[6];
    const agent3 = accounts[7];
    let oneBILDToken;
    let manyBILDTokens;

    before(async () => {
        whitelist = await Whitelist.deployed();
    });

    describe('Governors', () => {
        beforeEach(async () => {
            whitelist = await Whitelist.new();
            /* await whitelist.addGovernor(governor, {
                from: owner,
            });
            await whitelist.addStakeholder(stakeholder, {
                from: governor,
            }); */
        });

        itShouldThrow(
            'General users can\'t add governors.',
            async () => {    
                await whitelist.addGovernor(governor, {
                    from: nonStakeholder,
                });
            },
            'revert',
        );

        it('The contract owner can add governors.', async () => {
            assert.equal(await whitelist.isGovernor(governor), false);
            await whitelist.addGovernor(governor, {
                from: owner,
            });
            assert.equal(await whitelist.isGovernor(governor), true);
        });

        itShouldThrow(
            'General users can\'t remove governors.',
            async () => {    
                assert.equal(await whitelist.isGovernor(governor), false);
                await whitelist.addGovernor(governor, {
                    from: owner,
                });
                assert.equal(await whitelist.isGovernor(governor), true);
                await whitelist.removeGovernor(governor, {
                    from: nonStakeholder,
                });
            },
            'revert',
        );

        it('The contract owner can remove governors.', async () => {
            assert.equal(await whitelist.isGovernor(governor), false);
            await whitelist.addGovernor(governor, {
                from: owner,
            });
            assert.equal(await whitelist.isGovernor(governor), true);
            await whitelist.removeGovernor(governor, {
                from: owner,
            });
            assert.equal(await whitelist.isGovernor(governor), false);
        });
    });

    describe('Stakeholders', () => {
        beforeEach(async () => {
            whitelist = await Whitelist.new();
            await whitelist.addGovernor(governor, {
                from: owner,
            });
            /* await whitelist.addStakeholder(stakeholder, {
                from: governor,
            }); */
        });

        itShouldThrow(
            'General users can\'t add stakeholders.',
            async () => {    
                await whitelist.addStakeholder(stakeholder, {
                    from: nonStakeholder,
                });
            },
            'Message sender isn\'t part of the governance whitelist.',
        );

        it('Governors can add stakeholders.', async () => {
            assert.equal(await whitelist.isStakeholder(stakeholder), false);
            await whitelist.addStakeholder(stakeholder, {
                from: governor,
            });
            assert.equal(await whitelist.isStakeholder(stakeholder), true);
        });

        itShouldThrow(
            'General users can\'t remove stakeholders.',
            async () => {    
                assert.equal(await whitelist.isStakeholder(stakeholder), false);
                await whitelist.addStakeholder(stakeholder, {
                    from: governor,
                });
                assert.equal(await whitelist.isStakeholder(stakeholder), true);
                await whitelist.removeStakeholder(stakeholder, {
                    from: nonStakeholder,
                });
            },
            'Message sender isn\'t part of the governance whitelist.',
        );

        it('Governors can remove stakeholders.', async () => {
            assert.equal(await whitelist.isStakeholder(stakeholder), false);
            await whitelist.addStakeholder(stakeholder, {
                from: governor,
            });
            assert.equal(await whitelist.isStakeholder(stakeholder), true);
            await whitelist.removeStakeholder(stakeholder, {
                from: governor,
            });
            assert.equal(await whitelist.isStakeholder(stakeholder), false);
        });
    });
});
