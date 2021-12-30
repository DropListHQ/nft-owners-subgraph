import { Address, BigInt, store, Bytes, log } from '@graphprotocol/graph-ts'
import { ERC721, Transfer } from '../generated/templates/NftContract/ERC721'
import { ERC721Metadata } from '../generated/templates/NftContract/ERC721Metadata'
import { Nft, NftOwner, NftContract, ContractOwner } from '../generated/schema'
import { BIGINT_ONE, BIGINT_ZERO, ZERO_ADDRESS } from './constants'

export function handleTransfer (event: Transfer): void {
  let address = event.address.toHexString()
  let nftId = address + '/' + event.params.tokenId.toString()
  let contract = ERC721Metadata.bind(event.address)
  let nft = Nft.load(nftId)
  if (nft == null) {
    nft = new Nft(nftId)
    nft.contract = address
    nft.tokenID = event.params.tokenId

    let metadataURI = contract.try_tokenURI(event.params.tokenId)
    if (!metadataURI.reverted) {
      nft.tokenURI = normalize(metadataURI.value)
    } else {
      nft.tokenURI = ''
    }
    nft.createdAt = event.block.timestamp
    nft.save()
  }

  if (event.params.to == ZERO_ADDRESS) {
    // burn token
    nft.removedAt = event.block.timestamp
    nft.save()
  }

  let nftContract = NftContract.load(address);

  let ownershipId = nftId + '/' + event.params.to.toHexString()
  let nftOwner = NftOwner.load(ownershipId)

  if (event.params.from != ZERO_ADDRESS) {
    // Transferring from, decrement number of tokens for this owner
    let contractOwnerId = address + "/" + event.params.from.toHexString();
    let contractOwner = ContractOwner.load(contractOwnerId) 
    if (contractOwner != null) {
      // if numTokens = 1, transferring from this user, decerment numOwners in NftContract
      if (contractOwner.numTokens != null && contractOwner.numTokens.equals(BIGINT_ONE)) {
        nftContract.numOwners = nftContract.numOwners.minus(BIGINT_ONE);
      }
      contractOwner.numTokens = contractOwner.numTokens.minus(BIGINT_ONE);
      contractOwner.save();
    }

    updateOwnership(nftId, event.params.from, BIGINT_ZERO.minus(BIGINT_ONE), nftContract, nftOwner);
  }

  if (event.params.to != ZERO_ADDRESS) {
    // Transferring to, increment numTokens for this owner
    let newContractOwnerId = address + "/" + event.params.to.toHexString();
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
  updateOwnership(nftId, event.params.to, BIGINT_ONE, nftContract, nftOwner)
}

export function updateOwnership (
  nftId: string,
  owner: Address,
  deltaQuantity: BigInt,
  contract: NftContract | null,
  nftOwner: NftOwner | null
): void {
  let ownershipId = nftId + '/' + owner.toHexString()
  // let nftOwner = NftOwners.load(ownershipId)

  if (nftOwner == null) {
    nftOwner = new NftOwner(ownershipId)
    nftOwner.nft = nftId
    nftOwner.owner = owner
    nftOwner.quantity = BIGINT_ZERO
    nftOwner.contract = contract.id
  }

  let newQuantity = nftOwner.quantity.plus(deltaQuantity)

  if (newQuantity.lt(BIGINT_ZERO)) {
    log.debug('Negative token quantity: ' + newQuantity.toString(), [])
    store.remove('NftOwner', ownershipId)
  } else if (newQuantity.isZero()) {
    store.remove('NftOwner', ownershipId)
  } else {
    nftOwner.quantity = newQuantity
    nftOwner.save()
  }
}

export function supportsInterfaceErc721 (
  contract: ERC721,
  interfaceId: String,
  expected: boolean = true
): boolean {
  let supports = contract.try_supportsInterface(toBytes(interfaceId))
  return !supports.reverted && supports.value == expected
}

export function normalize (strValue: string): string {
  if (strValue.length === 1 && strValue.charCodeAt(0) === 0) {
    return ''
  } else {
    for (let i = 0; i < strValue.length; i++) {
      if (strValue.charCodeAt(i) === 0) {
        strValue = setCharAt(strValue, i, '\ufffd') // graph-node db does not support string with '\u0000'
      }
    }
    return strValue
  }
}

export function setCharAt (str: string, index: i32, char: string): string {
  if (index > str.length - 1) return str
  return str.substr(0, index) + char + str.substr(index + 1)
}

export function toBytes (hexString: String): Bytes {
  let result = new Uint8Array(hexString.length / 2)
  for (let i = 0; i < hexString.length; i += 2) {
    result[i / 2] = parseInt(hexString.substr(i, 2), 16) as u32
  }
  return result as Bytes
}

export function fetchName (tokenAddress: Address): string {
  let contract = ERC721Metadata.bind(tokenAddress)
  let name = contract.try_name()
  if (!name.reverted) {
    return normalize(name.value)
  } else {
    return ''
  }
}

export function fetchSymbol (tokenAddress: Address): string {
  let contract = ERC721Metadata.bind(tokenAddress)
  let symbol = contract.try_symbol()
  if (!symbol.reverted) {
    return normalize(symbol.value)
  } else {
    return ''
  }
}
