**THIS CHECKLIST IS NOT COMPLETE**. Use `--show-ignored-findings` to show all the results.
Summary
 - [arbitrary-send-erc20](#arbitrary-send-erc20) (1 results) (High)
 - [unchecked-transfer](#unchecked-transfer) (1 results) (High)
 - [pess-double-entry-token-alert](#pess-double-entry-token-alert) (1 results) (High)
 - [pess-strange-setter](#pess-strange-setter) (1 results) (High)
 - [unchecked-lowlevel](#unchecked-lowlevel) (2 results) (Medium)
 - [uninitialized-local](#uninitialized-local) (6 results) (Medium)
 - [unused-return](#unused-return) (1 results) (Medium)
 - [pess-nft-approve-warning](#pess-nft-approve-warning) (2 results) (Medium)
 - [pess-call-forward-to-protected](#pess-call-forward-to-protected) (1 results) (Medium)
 - [missing-zero-check](#missing-zero-check) (3 results) (Low)
 - [calls-loop](#calls-loop) (6 results) (Low)
 - [timestamp](#timestamp) (1 results) (Low)
 - [pess-dubious-typecast](#pess-dubious-typecast) (4 results) (Low)
 - [assembly](#assembly) (3 results) (Informational)
 - [solc-version](#solc-version) (14 results) (Informational)
 - [low-level-calls](#low-level-calls) (3 results) (Informational)
 - [naming-convention](#naming-convention) (4 results) (Informational)
 - [similar-names](#similar-names) (1 results) (Informational)
 - [pess-magic-number](#pess-magic-number) (2 results) (Informational)
 - [immutable-states](#immutable-states) (2 results) (Optimization)
## arbitrary-send-erc20
Impact: High
Confidence: High
 - [ ] ID-0
[JamBalanceManager.transferTokens(address,JamTransfer.Initial,address[],uint256[],uint256[],bytes)](src/JamBalanceManager.sol#L37-L89) uses arbitrary from in transferFrom: [IERC20(tokens[i]).safeTransferFrom(from,info.balanceRecipient,amounts[i])](src/JamBalanceManager.sol#L49)

src/JamBalanceManager.sol#L37-L89


## unchecked-transfer
Impact: High
Confidence: Medium
 - [ ] ID-1
[JamSolver.execute(JamInteraction.Data[],address[],uint256[],address)](src/JamSolver.sol#L50-L60) ignores return value by [token.transfer(receiver,outputAmounts[i_scope_0])](src/JamSolver.sol#L58)

src/JamSolver.sol#L50-L60


## pess-double-entry-token-alert
Impact: High
Confidence: Low
 - [ ] ID-2
JamSettlement [JamSettlement.transferTokensFromContract(address[],uint256[],uint256[],bytes,address)](src/JamSettlement.sol#L31-L56) might be vulnerable to double-entry token exploit

src/JamSettlement.sol#L31-L56


## pess-strange-setter
Impact: High
Confidence: Medium
 - [ ] ID-3
Function [JamSettlement.settle(JamOrder.Data,Signature.TypedSignature,JamInteraction.Data[],JamHooks.Def,JamTransfer.Initial)](src/JamSettlement.sol#L71-L87) is a strange setter. Nothing is set in constructor or set in a function without using function parameters

src/JamSettlement.sol#L71-L87


## unchecked-lowlevel
Impact: Medium
Confidence: Medium
 - [ ] ID-4
[JamBalanceManager.transferTokens(address,JamTransfer.Initial,address[],uint256[],uint256[],bytes)](src/JamBalanceManager.sol#L37-L89) ignores return value by [address(info.balanceRecipient).call{value: amounts[i]}()](src/JamBalanceManager.sol#L64)

src/JamBalanceManager.sol#L37-L89


 - [ ] ID-5
[JamSolver.withdraw(address)](src/JamSolver.sol#L35-L39) ignores return value by [address(receiver).call{value: address(this).balance}()](src/JamSolver.sol#L37)

src/JamSolver.sol#L35-L39


## uninitialized-local
Impact: Medium
Confidence: Medium
 - [ ] ID-6
[JamSolver.withdrawTokens(address[],address).i](src/JamSolver.sol#L42) is a local variable never initialized

src/JamSolver.sol#L42


 - [ ] ID-7
[JamSolver.execute(JamInteraction.Data[],address[],uint256[],address).i](src/JamSolver.sol#L53) is a local variable never initialized

src/JamSolver.sol#L53


 - [ ] ID-8
[JamSolver.execute(JamInteraction.Data[],address[],uint256[],address).i_scope_0](src/JamSolver.sol#L56) is a local variable never initialized

src/JamSolver.sol#L56


 - [ ] ID-9
[JamSettlement.runInteractions(JamInteraction.Data[]).i](src/JamSettlement.sol#L59) is a local variable never initialized

src/JamSettlement.sol#L59


 - [ ] ID-10
[JamSettlement.transferTokensFromContract(address[],uint256[],uint256[],bytes,address).nftInd](src/JamSettlement.sol#L38) is a local variable never initialized

src/JamSettlement.sol#L38


 - [ ] ID-11
[JamSettlement.transferTokensFromContract(address[],uint256[],uint256[],bytes,address).i](src/JamSettlement.sol#L39) is a local variable never initialized

src/JamSettlement.sol#L39


## unused-return
Impact: Medium
Confidence: Medium
 - [ ] ID-12
[JamSolver.execute(JamInteraction.Data[],address[],uint256[],address)](src/JamSolver.sol#L50-L60) ignores return value by [JamInteraction.execute(calls[i])](src/JamSolver.sol#L54)

src/JamSolver.sol#L50-L60


## pess-nft-approve-warning
Impact: Medium
Confidence: Low
 - [ ] ID-13
JamBalanceManager transferTokens parameter from is not related to msg.sender [IERC721(tokens[i]).safeTransferFrom(from,info.balanceRecipient,nftIds[indices.curNFTsInd])](src/JamBalanceManager.sol#L68)

src/JamBalanceManager.sol#L68


 - [ ] ID-14
JamSettlement transferTokensFromContract parameter from is not related to msg.sender [IERC721(tokens[i]).safeTransferFrom(address(this),receiver,nftIds[nftInd ++])](src/JamSettlement.sol#L47)

src/JamSettlement.sol#L47


## pess-call-forward-to-protected
Impact: Medium
Confidence: Low
 - [ ] ID-15
Function [JamSolver.withdraw(address)](src/JamSolver.sol#L35-L39) contains a low level call to a custom address

src/JamSolver.sol#L35-L39


## missing-zero-check
Impact: Low
Confidence: Medium
 - [ ] ID-16
[JamSolver.constructor(address)._settlement](src/JamSolver.sol#L13) lacks a zero-check on :
		- [settlement = _settlement](src/JamSolver.sol#L15)

src/JamSolver.sol#L13


 - [ ] ID-17
[JamSolver.withdraw(address).receiver](src/JamSolver.sol#L35) lacks a zero-check on :
		- [address(receiver).call{value: address(this).balance}()](src/JamSolver.sol#L37)

src/JamSolver.sol#L35


 - [ ] ID-18
[JamBalanceManager.constructor(address,address)._operator](src/JamBalanceManager.sol#L24) lacks a zero-check on :
		- [operator = _operator](src/JamBalanceManager.sol#L27)

src/JamBalanceManager.sol#L24


## calls-loop
Impact: Low
Confidence: Medium
 - [ ] ID-19
[JamSolver.withdrawTokens(address[],address)](src/JamSolver.sol#L41-L48) has external calls inside a loop: [token.safeTransfer(receiver,token.balanceOf(address(this)))](src/JamSolver.sol#L45)

src/JamSolver.sol#L41-L48


 - [ ] ID-20
[JamBalanceManager.transferTokens(address,JamTransfer.Initial,address[],uint256[],uint256[],bytes)](src/JamBalanceManager.sol#L37-L89) has external calls inside a loop: [IERC721(tokens[i]).safeTransferFrom(from,info.balanceRecipient,nftIds[indices.curNFTsInd])](src/JamBalanceManager.sol#L68)

src/JamBalanceManager.sol#L37-L89


 - [ ] ID-21
[JamBalanceManager.transferTokens(address,JamTransfer.Initial,address[],uint256[],uint256[],bytes)](src/JamBalanceManager.sol#L37-L89) has external calls inside a loop: [IERC1155(tokens[i]).safeTransferFrom(from,info.balanceRecipient,nftIds[indices.curNFTsInd],amounts[i],)](src/JamBalanceManager.sol#L71)

src/JamBalanceManager.sol#L37-L89


 - [ ] ID-22
[JamSolver.withdrawTokens(address[],address)](src/JamSolver.sol#L41-L48) has external calls inside a loop: [token.balanceOf(address(this)) > 0](src/JamSolver.sol#L44)

src/JamSolver.sol#L41-L48


 - [ ] ID-23
[JamBalanceManager.transferTokens(address,JamTransfer.Initial,address[],uint256[],uint256[],bytes)](src/JamBalanceManager.sol#L37-L89) has external calls inside a loop: [address(info.balanceRecipient).call{value: amounts[i]}()](src/JamBalanceManager.sol#L64)

src/JamBalanceManager.sol#L37-L89


 - [ ] ID-24
[JamSolver.execute(JamInteraction.Data[],address[],uint256[],address)](src/JamSolver.sol#L50-L60) has external calls inside a loop: [token.transfer(receiver,outputAmounts[i_scope_0])](src/JamSolver.sol#L58)

src/JamSolver.sol#L50-L60


## timestamp
Impact: Low
Confidence: Medium
 - [ ] ID-25
[JamSigning.validateOrder(JamOrder.Data,JamHooks.Def,Signature.TypedSignature)](src/JamSigning.sol#L105-L119) uses timestamp for comparisons
	Dangerous comparisons:
	- [require(bool,string)(block.timestamp < order.expiry,ORDER_EXPIRED)](src/JamSigning.sol#L117)

src/JamSigning.sol#L105-L119


## pess-dubious-typecast
Impact: Low
Confidence: Low
 - [ ] ID-26
Function [JamSolver.withdraw(address)](src/JamSolver.sol#L35-L39) has a dubious typecast: address<=address

src/JamSolver.sol#L35-L39


 - [ ] ID-27
Function [JamSettlement.transferTokensFromContract(address[],uint256[],uint256[],bytes,address)](src/JamSettlement.sol#L31-L56) has a dubious typecast: address<=IERC20

src/JamSettlement.sol#L31-L56


 - [ ] ID-28
Function [JamSettlement.transferTokensFromContract(address[],uint256[],uint256[],bytes,address)](src/JamSettlement.sol#L31-L56) has a dubious typecast: address<=IERC1155

src/JamSettlement.sol#L31-L56


 - [ ] ID-29
Function [JamSettlement.transferTokensFromContract(address[],uint256[],uint256[],bytes,address)](src/JamSettlement.sol#L31-L56) has a dubious typecast: address<=IERC721

src/JamSettlement.sol#L31-L56


## assembly
Impact: Informational
Confidence: High
 - [ ] ID-30
[Signature.getRsv(bytes)](src/libraries/Signature.sol#L18-L32) uses assembly
	- [INLINE ASM](src/libraries/Signature.sol#L23-L27)

src/libraries/Signature.sol#L18-L32


 - [ ] ID-31
[JamSigning.validateSignature(address,bytes32,Signature.TypedSignature)](src/JamSigning.sol#L74-L103) uses assembly
	- [INLINE ASM](src/JamSigning.sol#L89-L93)

src/JamSigning.sol#L74-L103


 - [ ] ID-32
[JamBalanceManager.transferTokens(address,JamTransfer.Initial,address[],uint256[],uint256[],bytes)](src/JamBalanceManager.sol#L37-L89) uses assembly
	- [INLINE ASM](src/JamBalanceManager.sol#L79)

src/JamBalanceManager.sol#L37-L89


## solc-version
Impact: Informational
Confidence: High
 - [ ] ID-33
Pragma version[^0.8.17](src/JamSolver.sol#L2) allows old versions

src/JamSolver.sol#L2


 - [ ] ID-34
Pragma version[^0.8.17](src/libraries/Signature.sol#L2) allows old versions

src/libraries/Signature.sol#L2


 - [ ] ID-35
Pragma version[^0.8.17](src/JamSettlement.sol#L2) allows old versions

src/JamSettlement.sol#L2


 - [ ] ID-36
Pragma version[^0.8.17](src/libraries/JamInteraction.sol#L2) allows old versions

src/libraries/JamInteraction.sol#L2


 - [ ] ID-37
Pragma version[^0.8.17](src/libraries/JamHooks.sol#L2) allows old versions

src/libraries/JamHooks.sol#L2


 - [ ] ID-38
Pragma version[^0.8.17](src/libraries/common/SafeCast160.sol#L2) allows old versions

src/libraries/common/SafeCast160.sol#L2


 - [ ] ID-39
Pragma version[^0.8.17](src/libraries/JamOrder.sol#L2) allows old versions

src/libraries/JamOrder.sol#L2


 - [ ] ID-40
solc-0.8.17 is not recommended for deployment

 - [ ] ID-41
Pragma version[^0.8.17](src/interfaces/IJamSettlement.sol#L2) allows old versions

src/interfaces/IJamSettlement.sol#L2


 - [ ] ID-42
Pragma version[^0.8.17](src/interfaces/IPermit2.sol#L2) allows old versions

src/interfaces/IPermit2.sol#L2


 - [ ] ID-43
Pragma version[^0.8.17](src/interfaces/IJamBalanceManager.sol#L2) allows old versions

src/interfaces/IJamBalanceManager.sol#L2


 - [ ] ID-44
Pragma version[^0.8.17](src/JamBalanceManager.sol#L2) allows old versions

src/JamBalanceManager.sol#L2


 - [ ] ID-45
Pragma version[^0.8.17](src/JamSigning.sol#L2) allows old versions

src/JamSigning.sol#L2


 - [ ] ID-46
Pragma version[^0.8.17](src/libraries/JamTransfer.sol#L2) allows old versions

src/libraries/JamTransfer.sol#L2


## low-level-calls
Impact: Informational
Confidence: High
 - [ ] ID-47
Low level call in [JamBalanceManager.transferTokens(address,JamTransfer.Initial,address[],uint256[],uint256[],bytes)](src/JamBalanceManager.sol#L37-L89):
	- [address(info.balanceRecipient).call{value: amounts[i]}()](src/JamBalanceManager.sol#L64)

src/JamBalanceManager.sol#L37-L89


 - [ ] ID-48
Low level call in [JamInteraction.execute(JamInteraction.Data)](src/libraries/JamInteraction.sol#L18-L21):
	- [(_result) = address(interaction.to).call{value: interaction.value}(interaction.data)](src/libraries/JamInteraction.sol#L19)

src/libraries/JamInteraction.sol#L18-L21


 - [ ] ID-49
Low level call in [JamSolver.withdraw(address)](src/JamSolver.sol#L35-L39):
	- [address(receiver).call{value: address(this).balance}()](src/JamSolver.sol#L37)

src/JamSolver.sol#L35-L39


## naming-convention
Impact: Informational
Confidence: High
 - [ ] ID-50
Variable [JamBalanceManager.PERMIT2](src/JamBalanceManager.sol#L22) is not in mixedCase

src/JamBalanceManager.sol#L22


 - [ ] ID-51
Function [JamSigning.DOMAIN_SEPARATOR()](src/JamSigning.sol#L37-L43) is not in mixedCase

src/JamSigning.sol#L37-L43


 - [ ] ID-52
Variable [JamSigning._CACHED_CHAIN_ID](src/JamSigning.sol#L28) is not in mixedCase

src/JamSigning.sol#L28


 - [ ] ID-53
Variable [JamSigning._CACHED_DOMAIN_SEPARATOR](src/JamSigning.sol#L27) is not in mixedCase

src/JamSigning.sol#L27


## similar-names
Impact: Informational
Confidence: Medium
 - [ ] ID-54
Variable [JamSettlement.transferTokensFromContract(address[],uint256[],uint256[],bytes,address).tokenBalance_scope_0](src/JamSettlement.sol#L45) is too similar to [JamSettlement.transferTokensFromContract(address[],uint256[],uint256[],bytes,address).tokenBalance_scope_1](src/JamSettlement.sol#L49)

src/JamSettlement.sol#L45


## pess-magic-number
Impact: Informational
Confidence: High
 - [ ] ID-55
Function [Signature.getRsv(bytes)](src/libraries/Signature.sol#L18-L32) contains magic numbers: 65, 32, 64, 65, 27, 27, 27

src/libraries/Signature.sol#L18-L32


 - [ ] ID-56
Function [JamSigning.validateSignature(address,bytes32,Signature.TypedSignature)](src/JamSigning.sol#L74-L103) contains magic number: 28

src/JamSigning.sol#L74-L103


## immutable-states
Impact: Optimization
Confidence: High
 - [ ] ID-57
[JamSolver.owner](src/JamSolver.sol#L10) should be immutable 

src/JamSolver.sol#L10


 - [ ] ID-58
[JamSolver.settlement](src/JamSolver.sol#L11) should be immutable 

src/JamSolver.sol#L11


