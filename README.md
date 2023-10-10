# Bebop Jam

![Alt text](bebop.gif?raw=true "Title")

![Github Actions](https://github.com/bebop-dex/bebop-jam-contracts/workflows/test/badge.svg)


JAM (Just-in-Time Aggregation Model) is Bebop's upcoming DeFi liquidity aggregator system allowing any token to any token swaps with highly efficient execution quality.

JAM Solvers are independently run services that provide quotes to Bebop users on an RFQ (Request for Quote) basis. They are responsible for providing accurate prices and reliably executing swaps for the given quotes.


From  a  systems  perspective,  how  the  trade  is conducted can be defined as follows:

1.Bebop  JAM  orchestrator  receives  an  order request in the form: Buy  1000  Token  A  -  Sell  Token  B  - Slippage: 0. The requests support orders for    multiple    tokens    being    exchanged simultaneously.

2.It queries solvers for a solution to the trade; the best solution is returned to the user.

3.The user signs and therefore confirms their trade, producing a signature over the winning solver’s solution.

4.This signature is returned to the orchestrator.

5.The orchestrator passes the user’s signature to the winning solver for them to execute on-chain.

6.The  solver  returns  the  transaction  to  the orchestrator and eventually the user.

### Tests

*  Hardhat tests:
```bash
yarn
hardhat test
```

 *  Foundry tests(WIP): 
```bash
forge test
```

### Slither + Slitherin (extra detectors)

Install original slither and extra detectors:
```shell
pip3 install slither-analyzer
git clone https://github.com/pessimistic-io/slitherin.git
cd slitherin
python3 setup.py develop
```
Run slither:
```shell
slither --config-file slither.config.json --checklist . > slither.md
```