import { Address, BigInt, log } from '@graphprotocol/graph-ts'
import {
  ERC1155,
  TransferBatch,
  TransferSingle,
  URI
} from '../generated/ERC1155/ERC1155'
import { ERC1155Metadata } from '../generated/ERC1155/ERC1155Metadata'
import { ContractOwner, Nft, NftContract, NftOwner } from '../generated/schema'
import { BIGINT_ZERO, ZERO_ADDRESS, BIGINT_ONE } from './constants'
import { updateOwnership, normalize, toBytes } from './mapping'

export function handleTransferSingle (event: TransferSingle): void {
  transferBase(
    event.address,
    event.params.from,
    event.params.to,
    event.params.id,
    event.params.value,
    event.block.timestamp
  )
}

export function handleTransferBatch (event: TransferBatch): void {
  if (event.params.ids.length != event.params.values.length) {
    throw new Error('Inconsistent arrays length in TransferBatch')
  }

  for (let i = 0; i < event.params.ids.length; i++) {
    let ids = event.params.ids
    let values = event.params.values
    transferBase(
      event.address,
      event.params.from,
      event.params.to,
      ids[i],
      values[i],
      event.block.timestamp
    )
  }
}

export function supportsInterfaceErc1155 (
    contract: ERC1155,
    interfaceId: String,
    expected: boolean = true
  ): boolean {
    let supports = contract.try_supportsInterface(toBytes(interfaceId))
    return !supports.reverted && supports.value == expected
  }

export function handleURI (event: URI): void {
  let id = event.address.toHexString() + '/' + event.params.id.toString()
  let nft = Nft.load(id)
  if (nft != null) {
    nft.tokenURI = event.params.value
    nft.save()
  }
}

function transferBase (
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
    let contract = ERC1155.bind(contractAddress)
    nft = new Nft(nftId)
    nft.contract = contractAddress.toHexString()
    nft.tokenID = id
    if (supportsInterfaceErc1155(contract, '0e89341c')) {
      let contractMetadata = ERC1155Metadata.bind(contractAddress)
      let metadataURI = contractMetadata.try_uri(id)
      if (!metadataURI.reverted) {
        nft.tokenURI = normalize(metadataURI.value)
      } else {
        nft.tokenURI = ''
      }
    } else {
      nft.tokenURI = ''
    }
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

  let ownershipId = nftId; // + '/' + to.toHexString();
  let nftOwner = NftOwner.load(ownershipId)

  if (from != ZERO_ADDRESS) {
    // Transferring from, decrement numTokens for this owner
    let contractOwnerId = contractAddress.toHexString() + "/" + from.toHexString();
    let contractOwner = ContractOwner.load(contractOwnerId) 
    if (contractOwner != null) {
      // if numTokens = 1, transferring from this user, decerment numOwners in NftContract
      if (contractOwner.numTokens != null && contractOwner.numTokens.equals(BIGINT_ONE)) {
        nftContract.numOwners = nftContract.numOwners.minus(BIGINT_ONE);
      }
      contractOwner.numTokens = contractOwner.numTokens.minus(BIGINT_ONE);
      contractOwner.save();
    }
    updateOwnership(nftId, from, BIGINT_ZERO.minus(value), nftContract, nftOwner, timestamp)
  }

  if (to != ZERO_ADDRESS) {
    // Transferring to, increment numTokens for this owner
    let newContractOwnerId = contractAddress.toHexString() + "/" + to.toHexString();
    let newContractOwner = ContractOwner.load(newContractOwnerId)
    log.debug(`newContractOwnerId is {}`, [newContractOwnerId.toString()])
    // new owner
    if (newContractOwner == null) {
      newContractOwner = new ContractOwner(newContractOwnerId);
      newContractOwner.owner = ownershipId;
      newContractOwner.contract = nftContract.id;
      newContractOwner.numTokens = BIGINT_ZERO;
    }

    // if numTokens = 0, new owner found, increment numOwners in NftContract
    if (newContractOwner.numTokens.equals(BIGINT_ZERO)) {
      nftContract.numOwners = nftContract.numOwners.plus(BIGINT_ONE);
    }
    newContractOwner.numTokens = newContractOwner.numTokens.plus(BIGINT_ONE);
    newContractOwner.save();
  } else { // burn
    // store.remove('Nft', id);
    nftContract.numTokens = nftContract.numTokens.minus(BIGINT_ONE);
  }
  updateOwnership(nftId, to, value, nftContract, nftOwner, timestamp);
}
