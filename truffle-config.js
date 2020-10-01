const { projectId, mnemonic } = require('./.secret.json');
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
    networks: {
        development: {
            host: '127.0.0.1',
            port: 8545,
            network_id: '*',
        },
        ropsten: {
            provider: () => new HDWalletProvider(mnemonic, `https://ropsten.infura.io/v3/${projectId}`),
            network_id: 3,
            // gas: 4054492,
            gas: 4000000,
            // gas: 28969903,
            gasPrice: 13000000000,
            confirmations: 2,
            skipDryRun: true,
        },
        kovan: {
            provider: () => new HDWalletProvider(mnemonic, `https://kovan.infura.io/v3/${projectId}`),
            network_id: 42,
            gas: 7000000,
            gasPrice: 10000000000,
            skipDryRun: true,
        },
        rinkeby: {
            provider: () => new HDWalletProvider(mnemonic, `https://rinkeby.infura.io/v3/${projectId}`),
            network_id: 4,
            gas: 7000000,
            gasPrice: 10000000000,
            skipDryRun: true
        },
    },

    mocha: {
        // see more here: https://www.npmjs.com/package/eth-gas-reporter
        // reporter: 'eth-gas-reporter',
    },

    solc: {
        optimizer: {
            enabled: true,
            runs: 200,
        },
    },

    compilers: {
        solc: {
            version: '0.5.7',
        },
    },
};
