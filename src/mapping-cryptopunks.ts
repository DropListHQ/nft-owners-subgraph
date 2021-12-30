import { Nft, NftContract, NftOwner, ContractOwner } from '../generated/schema'
import { Address, BigInt, store, Bytes } from '@graphprotocol/graph-ts'
import { BIGINT_ZERO, ZERO_ADDRESS, BIGINT_ONE } from './constants'
import {
  CryptoPunk,
  Assign as AssignEvent,
  PunkBidEntered as PunkBidEnteredEvent,
  PunkBidWithdrawn as PunkBidWithdrawnEvent,
  PunkBought as PunkBoughtEvent,
  PunkNoLongerForSale as PunkNoLongerForSaleEvent,
  PunkOffered as PunkOfferedEvent,
  PunkTransfer as PunkTransferEvent,
  Transfer as TransferEvent
} from '../generated/CryptoPunks/CryptoPunk'
import { updateOwnership, normalize, toBytes } from './mapping'

const ONCHAIN_PUNKS_CONTRACT_ADDRESS = '0x16f5a35647d6f03d5d3da7b35409d65ba03af3b2'

export function handleAssign (event: AssignEvent): void {
  ensureNftContract(event.address)
  processTransfer(
    event.address,
    ZERO_ADDRESS,
    event.params.to,
    event.params.punkIndex,
    BIGINT_ONE,
    event.block.timestamp
  )
}

export function handlePunkBidEntered (event: PunkBidEnteredEvent): void {}

export function handlePunkBidWithdrawn (event: PunkBidWithdrawnEvent): void {}

export function handlePunkBought (event: PunkBoughtEvent): void {}

export function handlePunkNoLongerForSale (
  event: PunkNoLongerForSaleEvent
): void {}

export function handlePunkOffered (event: PunkOfferedEvent): void {}

export function handlePunkTransfer (event: PunkTransferEvent): void {
  ensureNftContract(event.address)
  processTransfer(
    event.address,
    event.params.from,
    event.params.to,
    event.params.punkIndex,
    BIGINT_ONE,
    event.block.timestamp
  )
}

export function handleTransfer (event: TransferEvent): void {}

export function ensureNftContract (address: Address): void {
  if (NftContract.load(address.toHexString()) == null) {
    let contract = CryptoPunk.bind(address)
    let nftContract = new NftContract(address.toHexString())

    let name = contract.try_name()
    if (!name.reverted) {
      nftContract.name = normalize(name.value)
    } else {
      nftContract.name = ''
    }
    let symbol = contract.try_symbol()
    if (!symbol.reverted) {
      nftContract.symbol = normalize(symbol.value)
    } else {
      nftContract.symbol = ''
    }
    nftContract.numTokens = BIGINT_ZERO;
    nftContract.numOwners = BIGINT_ZERO;
    nftContract.type = 'CRYPTOPUNKS'
    nftContract.save()
  }
}

export function processTransfer (
  contractAddress: Address,
  from: Address,
  to: Address,
  id: BigInt,
  value: BigInt,
  timestamp: BigInt
): void {
  let nftId = contractAddress.toHexString() + '/' + id.toString()
  let nft = Nft.load(nftId)
  if (nft == null) {
    nft = new Nft(nftId)
    nft.contract = contractAddress.toHexString()
    nft.tokenID = id
    nft.tokenURI = ONCHAIN_PUNKS_CONTRACT_ADDRESS
    nft.creatorAddress = from
    nft.createdAt = timestamp
    nft.save()
  }

  if (to == ZERO_ADDRESS) {
    // burn token
    nft.removedAt = timestamp
    nft.save()
  }

  let nftContract = NftContract.load(contractAddress.toHexString());

  let ownershipId = nftId + '/' + to.toHexString()
  let nftOwner = NftOwner.load(ownershipId)

  if (from != ZERO_ADDRESS) {
    // Transferring from, decrement numTokens for this owner
    let contractOwnerId = contractAddress.toHexString() + "/" + from.toHexString();
    let contractOwner = ContractOwner.load(contractOwnerId) 
    if (contractOwner != null) {
      // if numTokens = 1, transferring from this user, decerment numOwners in NftContract
      if (contractOwner.numTokens.equals(BIGINT_ONE)) {
        nftContract.numOwners = nftContract.numOwners.minus(BIGINT_ONE);
      }
      contractOwner.numTokens = contractOwner.numTokens.minus(BIGINT_ONE);
      contractOwner.save();
    }

    updateOwnership(nftId, from, BIGINT_ZERO.minus(value), nftContract, nftOwner);
  }

  if (to != ZERO_ADDRESS) {
    // Transferring to, increment numTokens for this owner
    let newContractOwnerId = contractAddress.toHexString() + "/" + to.toHexString();
    let newContractOwner = ContractOwner.load(newContractOwnerId)
    // empty = new owner
    if (newContractOwner == null) {
      newContractOwner = new ContractOwner(newContractOwnerId);
      newContractOwner.owner = ownershipId;
      newContractOwner.contract = nftContract.id;
      newContractOwner.numTokens = BIGINT_ZERO;
    }

    // if numTokens = 1, new owner found, increment numOwners in NftContract
    if (newContractOwner.numTokens.equals(BIGINT_ONE)) {
      nftContract.numOwners = nftContract.numOwners.plus(BIGINT_ONE);
    }
    newContractOwner.numTokens = newContractOwner.numTokens.plus(BIGINT_ONE);
    newContractOwner.save();
    nftContract.numTokens = nftContract.numTokens.plus(BIGINT_ONE);    
  } else { // burn
    // store.remove('Nft', id);
    nftContract.numTokens = nftContract.numTokens.minus(BIGINT_ONE);
  }
  nftContract.save();
  updateOwnership(nftId, to, value, nftContract, nftOwner);
}
