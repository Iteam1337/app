import { sign } from './jwt'
import { getAccount, getAccountKeys, getConnection } from './storage'
import Config from 'react-native-config'
import { schemas } from '@egendata/messaging'

export const createAccountRegistration = async (
  // eslint-disable-next-line camelcase
  { id, pds: { provider, access_token } },
  { publicKey, privateKeyPem, privateKey },
) => {
  return sign(
    {
      type: 'ACCOUNT_REGISTRATION',
      aud: Config.OPERATOR_URL,
      iss: `egendata://account/${id}`,
      pds: { provider, access_token },
    },
    {
      jwk: privateKey,
      pem: privateKeyPem,
    },
    {
      jwk: publicKey,
      alg: schemas.algs[0],
    },
  )
}

export const createConnection = async (
  { iss, sid },
  permissions,
  connectionId,
) => {
  const { publicKey, privateKey, privateKeyPem } = await getAccountKeys()
  const body = {
    type: 'CONNECTION',
    aud: iss,
    iss: 'egendata://account',
    sid,
    sub: connectionId,
    permissions,
  }
  return sign(
    body,
    {
      jwk: privateKey,
      pem: privateKeyPem,
    },
    {
      jwk: publicKey,
      alg: schemas.algs[0],
    },
  )
}

export const createConnectionResponse = async payload => {
  const { id } = await getAccount()
  const { publicKey, privateKey, privateKeyPem } = await getAccountKeys()
  return sign(
    {
      type: 'CONNECTION_RESPONSE',
      aud: Config.OPERATOR_URL,
      iss: `egendata://account/${id}`,
      payload,
    },
    {
      jwk: privateKey,
      pem: privateKeyPem,
    },
    { jwk: publicKey, alg: schemas.algs[0] },
  )
}

export const createLogin = async ({ serviceId, connectionId }, sessionId) => {
  if (!sessionId) {
    throw Error('SessionId is missing')
  }
  const { publicKey, privateKey, privateKeyPem } = await getAccountKeys()
  return sign(
    {
      type: 'LOGIN',
      aud: serviceId,
      sid: sessionId,
      sub: connectionId,
      iss: 'egendata://account',
    },
    {
      jwk: privateKey,
      pem: privateKeyPem,
    },
    { jwk: publicKey, alg: schemas.algs[0] },
  )
}

export const createLoginResponse = async loginPayload => {
  const { id } = await getAccount()
  const { publicKey, privateKey, privateKeyPem } = await getAccountKeys()
  return sign(
    {
      type: 'LOGIN_RESPONSE',
      payload: loginPayload,
      iss: `egendata://account/${id}`,
      aud: Config.OPERATOR_URL,
    },
    {
      jwk: privateKey,
      pem: privateKeyPem,
    },
    { jwk: publicKey, alg: schemas.algs[0] },
  )
}

export async function getRecipients({ domain, area }) {
  const { publicKey, privateKey, privateKeyPem } = await getAccountKeys()
  const connectionId = getConnection(domain)

  return sign(
    {
      type: 'RECIPIENTS_READ_REQUEST',
      sub: connectionId,
      paths: [{ domain, area }],
    },
    {
      jwk: privateKey,
      pem: privateKeyPem,
    },
    { jwk: publicKey, alg: schemas.algs[0] },
  ).then(postToOperator)
}
// ToOoOoToOT
// poopstoopidooperator
export function postToOperator(body) {
  return fetch(Config.OPERATOR_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/jwt' },
    body,
  })
}
