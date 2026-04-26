import { useEffect, useState } from 'react'
import { useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { formatEther, parseEther } from 'viem'
import { VAULT_ABI, getVaultAddress } from '../contracts/VaultABI'

const formatEth = (value, digits = 4) => {
  if (value === undefined || value === null) {
    return `0.${'0'.repeat(digits)} ETH`
  }

  return `${parseFloat(formatEther(value)).toFixed(digits)} ETH`
}

const formatPercent = (value) => {
  if (value === undefined || value === null) {
    return '0.00%'
  }

  return `${(Number(value) / 100).toFixed(2)}%`
}

const getNetworkName = (chainId) => {
  switch (chainId) {
    case 11155111:
      return 'Sepolia Testnet'
    case 31337:
      return 'Hardhat Local'
    default:
      return `Unsupported Network (${chainId})`
  }
}

const VaultDashboard = () => {
  const { address } = useAccount()
  const chainId = useChainId()
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')

  const vaultAddress = getVaultAddress(chainId)

  const { data: userBalance, refetch: refetchBalance } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'getBalance',
    args: [address],
  })

  const { data: userDeposit, refetch: refetchDeposit } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'deposits',
    args: [address],
  })

  const { data: pendingReward, refetch: refetchReward } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'calculateReward',
    args: [address],
  })

  const { data: totalEthLocked } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'totalEthLocked',
  })

  const { data: rewardMultiplier } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'rewardMultiplier',
  })

  const { data: contractVersion } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'version',
  })

  const {
    writeContract: deposit,
    data: depositHash,
    isPending: isDepositPending,
    error: depositError,
  } = useWriteContract()

  const {
    writeContract: withdraw,
    data: withdrawHash,
    isPending: isWithdrawPending,
    error: withdrawError,
  } = useWriteContract()

  const { isLoading: isDepositConfirming, isSuccess: isDepositConfirmed } = useWaitForTransactionReceipt({
    hash: depositHash,
  })

  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawConfirmed } = useWaitForTransactionReceipt({
    hash: withdrawHash,
  })

  useEffect(() => {
    if (isDepositConfirmed || isWithdrawConfirmed) {
      refetchBalance()
      refetchDeposit()
      refetchReward()
    }
  }, [isDepositConfirmed, isWithdrawConfirmed, refetchBalance, refetchDeposit, refetchReward])

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      return
    }

    try {
      deposit({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: 'deposit',
        value: parseEther(depositAmount),
      })
    } catch (error) {
      console.error('Deposit error:', error)
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawAmount) {
      return
    }

    if (withdrawAmount !== 'all' && parseFloat(withdrawAmount) <= 0) {
      return
    }

    try {
      const amount = withdrawAmount === 'all' ? 0n : parseEther(withdrawAmount)
      withdraw({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: 'withdraw',
        args: [amount],
      })
    } catch (error) {
      console.error('Withdraw error:', error)
    }
  }

  const getTransactionStatus = () => {
    if (isDepositPending || isDepositConfirming) {
      return { type: 'pending', message: 'Deposit transaction pending' }
    }

    if (isWithdrawPending || isWithdrawConfirming) {
      return { type: 'pending', message: 'Withdrawal transaction pending' }
    }

    if (isDepositConfirmed) {
      return { type: 'success', message: 'Deposit confirmed on-chain' }
    }

    if (isWithdrawConfirmed) {
      return { type: 'success', message: 'Withdrawal confirmed on-chain' }
    }

    if (depositError) {
      return { type: 'error', message: `Deposit failed: ${depositError.message}` }
    }

    if (withdrawError) {
      return { type: 'error', message: `Withdrawal failed: ${withdrawError.message}` }
    }

    return null
  }

  const status = getTransactionStatus()
  const isContractDeployed = vaultAddress && vaultAddress !== '0x0000000000000000000000000000000000000000'
  const isSupportedNetwork = chainId === 11155111 || chainId === 31337
  const principal = userDeposit?.[0] || 0n
  const depositTimestamp = userDeposit?.[1] ? new Date(Number(userDeposit[1]) * 1000).toLocaleDateString() : 'No deposit yet'

  if (!isSupportedNetwork) {
    return (
      <section className="state-panel">
        <p className="section-label">Network status</p>
        <h2>Unsupported network</h2>
        <p>This interface is configured for Hardhat local and Sepolia only.</p>
        <div className="notice-list">
          <div className="notice-row">
            <span>Current network</span>
            <strong>{getNetworkName(chainId)}</strong>
          </div>
          <div className="notice-row">
            <span>Supported</span>
            <strong>Sepolia, Hardhat Local</strong>
          </div>
        </div>
      </section>
    )
  }

  if (!isContractDeployed) {
    return (
      <section className="state-panel">
        <p className="section-label">Deployment status</p>
        <h2>Vault contract unavailable</h2>
        <p>The dashboard could not resolve a vault address for the current network.</p>
        <div className="notice-list">
          <div className="notice-row">
            <span>Network</span>
            <strong>{getNetworkName(chainId)}</strong>
          </div>
          <div className="notice-row">
            <span>Configured address</span>
            <strong className="mono-text">{vaultAddress || 'Not configured'}</strong>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="dashboard-shell">
      <div className="summary-grid">
        <article className="summary-card">
          <p className="section-label">Wallet balance</p>
          <h2>{formatEth(userBalance)}</h2>
          <span>Tracked vault balance for the connected address</span>
        </article>
        <article className="summary-card">
          <p className="section-label">Pending reward</p>
          <h2>{formatEth(pendingReward, 6)}</h2>
          <span>Accrued reward estimate at the current block</span>
        </article>
        <article className="summary-card">
          <p className="section-label">Vault TVL</p>
          <h2>{formatEth(totalEthLocked, 2)}</h2>
          <span>Total ETH currently held by the vault</span>
        </article>
        <article className="summary-card">
          <p className="section-label">Reward rate</p>
          <h2>{formatPercent(rewardMultiplier)}</h2>
          <span>Current annualized reward multiplier</span>
        </article>
      </div>

      <div className="dashboard-layout">
        <div className="dashboard-main">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="section-label">Deposit</p>
                <h3>Add ETH to the vault</h3>
              </div>
            </div>
            <div className="form-stack">
              <label className="field">
                <span>Amount</span>
                <input
                  id="depositAmount"
                  type="number"
                  step="0.001"
                  placeholder="0.0"
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                  disabled={isDepositPending || isDepositConfirming}
                />
              </label>
              <button
                className="action-button action-button-primary"
                onClick={handleDeposit}
                disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isDepositPending || isDepositConfirming}
              >
                {isDepositPending || isDepositConfirming ? 'Processing deposit' : 'Deposit ETH'}
              </button>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="section-label">Withdraw</p>
                <h3>Withdraw position or rewards</h3>
              </div>
            </div>
            <div className="form-stack">
              <label className="field">
                <span>Amount</span>
                <input
                  id="withdrawAmount"
                  type="text"
                  placeholder="0.0 or all"
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                  disabled={isWithdrawPending || isWithdrawConfirming}
                />
              </label>
              <div className="button-row">
                <button
                  className="action-button action-button-secondary"
                  onClick={handleWithdraw}
                  disabled={!withdrawAmount || isWithdrawPending || isWithdrawConfirming}
                >
                  {isWithdrawPending || isWithdrawConfirming ? 'Processing withdrawal' : 'Withdraw'}
                </button>
                <button
                  className="action-button action-button-muted"
                  onClick={() => setWithdrawAmount('all')}
                  disabled={isWithdrawPending || isWithdrawConfirming}
                >
                  Use all
                </button>
              </div>
            </div>
          </article>

          {status && (
            <article className={`panel status-panel status-${status.type}`}>
              <p className="section-label">Transaction status</p>
              <h3>{status.message}</h3>
            </article>
          )}
        </div>

        <aside className="dashboard-side">
          <article className="panel">
            <p className="section-label">Connected network</p>
            <h3>{getNetworkName(chainId)}</h3>
            <div className="detail-list">
              <div className="detail-row">
                <span>Vault address</span>
                <strong className="mono-text">{vaultAddress}</strong>
              </div>
              <div className="detail-row">
                <span>Contract version</span>
                <strong>{contractVersion || 'N/A'}</strong>
              </div>
              <div className="detail-row">
                <span>Proxy standard</span>
                <strong>UUPS</strong>
              </div>
            </div>
          </article>

          <article className="panel">
            <p className="section-label">Position details</p>
            <h3>Current account</h3>
            <div className="detail-list">
              <div className="detail-row">
                <span>Principal</span>
                <strong>{formatEth(principal)}</strong>
              </div>
              <div className="detail-row">
                <span>Deposit date</span>
                <strong>{depositTimestamp}</strong>
              </div>
              <div className="detail-row">
                <span>Connected wallet</span>
                <strong className="mono-text">{address || 'Unavailable'}</strong>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </section>
  )
}

export default VaultDashboard
