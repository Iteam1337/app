import { verify } from './jwt'
import { getConnection, storeConnection, storeKey } from './storage'
import Config from 'react-native-config'
import { createConnectionInit } from './serviceAdapter'

import {
  createConnection,
  createConnectionResponse,
  createLogin,
  createLoginResponse,
} from './operatorAdapter'
import { v4 } from 'uuid'
import { generateKey, toPublicKey } from './crypto'

export const authenticationRequestHandler = async ({ payload }) => {
  const existingConnection = await getConnection(payload.iss)

  if (existingConnection) {
    return { existingConnection, sessionId: payload.sid }
  } else {
    const connectionRequest = await initConnection(payload)
    return { connectionRequest, sessionId: payload.sid }
  }
}

export const initConnection = async authRequest => {
  const connectionInit = await createConnectionInit(authRequest)
  try {
    const response = await fetch(authRequest.eventsURI, {
      method: 'POST',
      headers: { 'content-type': 'application/jwt' },
      body: connectionInit,
    })
    const JWTConnectionRequest = await response.text()
    const { payload: connectionRequest } = await verify(JWTConnectionRequest)
    return connectionRequest
  } catch (error) {
    console.error(error)
    throw Error('CONNECTION_INIT failed')
  }
}

export const approveConnection = async (connectionRequest, approved) => {
  try {
    const connectionId = v4()
    const permissionsResult = await createPermissionResult(
      connectionRequest,
      approved,
    )
    const connection = await createConnection(
      connectionRequest,
      permissionsResult,
      connectionId,
    )

    const connectionResponse = await createConnectionResponse(connection)

    await fetch(Config.OPERATOR_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/jwt' },
      body: connectionResponse,
    })

    await storeConnection({
      serviceId: connectionRequest.iss,
      displayName: connectionRequest.displayName,
      description: connectionRequest.description,
      iconURI: connectionRequest.iconURI,
      permissions: connectionRequest.permissions,
      connectionId,
    })
    return connectionId
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const approveLogin = async ({ connection, sessionId }) => {
  try {
    const login = await createLogin(connection, sessionId)
    const loginResponse = await createLoginResponse(login)
    const response = await fetch(Config.OPERATOR_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/jwt' },
      body: loginResponse,
    })
    return response.text()
  } catch (error) {
    console.error('error', error)
    throw Error('Could not approve Login')
  }
}

function mapReadKeys(permissions) {
  return permissions
    .filter(p => p.type === 'READ')
    .reduce((map, { domain, area, jwk }) => {
      return map.set(`${domain}|${area}`, jwk)
    }, new Map())
}

export async function createPermissionResult({ permissions }, approved) {
  if (!permissions) {
    return undefined
  }

  const readServiceReadKeysByArea = mapReadKeys(permissions)

  const permissionResult = {
    approved: await Promise.all(
      permissions
        .filter(p => approved.get(p.id))
        .map(async p => {
          if (p.type === 'WRITE') {
            if (!p.jwks) {
              p.jwks = {
                keys: [],
              }
            }
            // push service read-keys to jwks-keys
            const serviceReadKey = readServiceReadKeysByArea.get(
              `${p.domain}|${p.area}`,
            )
            if (serviceReadKey) {
              p.jwks.keys.push(serviceReadKey)
            }

            // push user read-key
            const key = await generateKey({
              use: 'enc',
            }).then(storeKey)

            p.jwks.keys.push(toPublicKey(key.privateKey))
          } else if (p.type === 'READ') {
            // todo: l8r if there are no recipients then create JWE with empty data

            // todo: get jwe recipients

            // if there are then add it to the recipeintseassesez

            p.kid = p.jwk.kid
            delete p.jwk
          }
          return p
        }),
    ),
  }
  return permissionResult.approved.length ? permissionResult : undefined
}
