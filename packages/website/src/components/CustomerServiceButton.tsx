import { EXT_LINK } from '@/lib/links'
import { WechatIcon } from './Icons'

const KF_LINK = 'https://work.weixin.qq.com/kfid/kfc55d33041a84f1321'

export default function CustomerServiceButton() {
  return (
    <a className="kf-float" href={KF_LINK} {...EXT_LINK} aria-label="联系客服">
      <WechatIcon />
      <span>联系客服</span>
    </a>
  )
}
