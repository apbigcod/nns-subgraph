// Import types and APIs from graph-ts
import {
  crypto,
  ens
} from '@graphprotocol/graph-ts'

import {
  createEventID, concat, ROOT_NODE, EMPTY_ADDRESS
} from './utils'

// Import event types from the registry contract ABI
import {
  NewOwner as NewOwnerEvent,
  Transfer as TransferEvent,
  NewResolver as NewResolverEvent,
  NewTTL as NewTTLEvent
} from './types/ENSRegistry/EnsRegistry'

// Import entity types generated from the GraphQL schema
import { Account, Domain, Resolver, NewOwner, Transfer, NewResolver, NewTTL } from './types/schema'

// Handler for NewOwner events
function _handleNewOwner(event: NewOwnerEvent, isMigrated:boolean): void {
  let account = new Account(event.params.owner.toHexString())
  account.save()

  let subnode = crypto.keccak256(concat(event.params.node, event.params.label)).toHexString()
  let domain = new Domain(subnode)

  if(domain.name == null) {
    // Get label and node names
    let label = ens.nameByHash(event.params.label.toHexString())
    if (label != null) {
      domain.labelName = label
    }

    if(label == null) {
      label = '[' + event.params.label.toHexString().slice(2) + ']'
    }
    if(event.params.node.toHexString() == '0x0000000000000000000000000000000000000000000000000000000000000000') {
      domain.name = label
    } else {
      let parent = Domain.load(event.params.node.toHexString())
      domain.name = label + '.' + parent.name
    }
  }

  domain.owner = account.id
  domain.parent = event.params.node.toHexString()
  domain.labelhash = event.params.label
  domain.isMigrated = isMigrated
  domain.save()

  let domainEvent = new NewOwner(createEventID(event))
  domainEvent.blockNumber = event.block.number.toI32()
  domainEvent.transactionID = event.transaction.hash
  domainEvent.domain = domain.id
  domainEvent.owner = account.id
  domainEvent.save()
}

// Handler for Transfer events
export function _handleTransfer(event: TransferEvent, isMigrated:boolean): void {
  let node = event.params.node.toHexString()

  let account = new Account(event.params.owner.toHexString())
  account.save()

  // Update the domain owner
  let domain = new Domain(node)
  if(node == ROOT_NODE){
    domain.isMigrated = isMigrated
  }
  domain.owner = account.id
  domain.save()

  let domainEvent = new Transfer(createEventID(event))
  domainEvent.blockNumber = event.block.number.toI32()
  domainEvent.transactionID = event.transaction.hash
  domainEvent.domain = node
  domainEvent.owner = account.id
  domainEvent.save()
}

// Handler for NewResolver events
function _handleNewResolver(event: NewResolverEvent, isMigrated:boolean): void {
  let id = event.params.resolver.toHexString().concat('-').concat(event.params.node.toHexString())

  let node = event.params.node.toHexString()
  let domain = new Domain(node)
  if(node == ROOT_NODE){
    domain.owner = EMPTY_ADDRESS
    domain.isMigrated = isMigrated
  }

  domain.resolver = id

  let resolver = Resolver.load(id)
  if(resolver == null) {
    resolver = new Resolver(id)
    resolver.domain = event.params.node.toHexString()
    resolver.address = event.params.resolver
    resolver.save()
  } else {
    domain.resolvedAddress = resolver.addr
  }

  domain.save()

  let domainEvent = new NewResolver(createEventID(event))
  domainEvent.blockNumber = event.block.number.toI32()
  domainEvent.transactionID = event.transaction.hash
  domainEvent.domain = node
  domainEvent.resolver = id
  domainEvent.save()
}

// Handler for NewTTL events
export function handleNewTTL(event: NewTTLEvent): void {
  let node = event.params.node.toHexString()
  let domain = new Domain(node)
  domain.ttl = event.params.ttl
  domain.save()

  let domainEvent = new NewTTL(createEventID(event))
  domainEvent.blockNumber = event.block.number.toI32()
  domainEvent.transactionID = event.transaction.hash
  domainEvent.domain = node
  domainEvent.ttl = event.params.ttl
  domainEvent.save()
}

export function handleNewOwner(event: NewOwnerEvent): void {
  _handleNewOwner(event, true)
}

export function handleNewOwnerOldRegistry(event: NewOwnerEvent): void {
  let subnode = crypto.keccak256(concat(event.params.node, event.params.label)).toHexString()
  let domain = Domain.load(subnode)
  if(domain == null || domain.isMigrated == false){
    _handleNewOwner(event, false)
  }
}

export function handleNewResolver(event: NewResolverEvent): void {
  _handleNewResolver(event, true)
}

export function handleNewResolverOldRegistry(event: NewResolverEvent): void {
  let node = event.params.node.toHexString()
  let domain = Domain.load(node)

  if(node == ROOT_NODE || domain.isMigrated == false){
    _handleNewResolver(event, false)
  }
}
export function handleNewTTLOldRegistry(event: NewTTLEvent): void {
  let domain = Domain.load(event.params.node.toHexString())
  if(domain.isMigrated == false){
    handleNewTTL(event)
  }
}

export function handleTransfer(event: TransferEvent): void {
  _handleTransfer(event, true)
}

export function handleTransferOldRegistry(event: TransferEvent): void {
  let node = event.params.node.toHexString()
  let domain = Domain.load(node)
  if(node == ROOT_NODE || domain.isMigrated == false){
    _handleTransfer(event, false)
  }
}
