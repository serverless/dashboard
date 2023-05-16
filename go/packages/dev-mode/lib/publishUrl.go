package lib

import (
	"fmt"
	"os"
)

func GetBaseUrl() string {
	// Some regions do not support http API so I am just
	// using the region closest to them in that case
	regionMap := map[string]string{
		"ap-northeast-3": "ap-northeast-2",
		"ap-southeast-3": "ap-southeast-2",
		"me-central-1":   "me-south-1",
		"us-gov-east-1":  "us-east-1",
		"us-gov-west-1":  "us-west-1",
	}
	functionUrlMap := map[string]map[string]string{
		"dev": {
			"us-east-1":      "https://uvwxuxl262yhrymjt22vwuliyq0loodn.lambda-url.us-east-1.on.aws",
			"us-gov-east-1":  "https://uvwxuxl262yhrymjt22vwuliyq0loodn.lambda-url.us-east-1.on.aws",
			"us-east-2":      "https://rjygrmm2xgisbz23umujxnsrzi0gyebc.lambda-url.us-east-2.on.aws",
			"us-west-1":      "https://m7lojuasmh24jyjetlgx3otlta0gedzf.lambda-url.us-west-1.on.aws",
			"us-gov-west-1":  "https://m7lojuasmh24jyjetlgx3otlta0gedzf.lambda-url.us-west-1.on.aws",
			"us-west-2":      "https://pncw7tc7sqqbqb5m7esxsluzzi0eiqfr.lambda-url.us-west-2.on.aws",
			"ap-south-1":     "https://oli7iperklmjwpbk5afpujlfey0dydrm.lambda-url.ap-south-1.on.aws",
			"ap-northeast-1": "https://opdn2fs2zaorfgqrztjjhucuba0ozpgf.lambda-url.ap-northeast-1.on.aws",
			"ap-northeast-2": "https://pklcj27zj6jvuglpcy6d2zbwbm0gfpvx.lambda-url.ap-northeast-2.on.aws",
			"ap-northeast-3": "https://pklcj27zj6jvuglpcy6d2zbwbm0gfpvx.lambda-url.ap-northeast-2.on.aws",
			"ap-southeast-1": "https://ibl4b22ziwmrzuoxrplmc7xigu0cwjys.lambda-url.ap-southeast-1.on.aws",
			"ap-southeast-2": "https://vksquwaovzqnzvrcmop2wwsoru0llvgx.lambda-url.ap-southeast-2.on.aws",
			"ap-southeast-3": "https://vksquwaovzqnzvrcmop2wwsoru0llvgx.lambda-url.ap-southeast-2.on.aws",
			"ca-central-1":   "https://2z4ljewgf5oyxbe6i7pdj7gynq0ixsdj.lambda-url.ca-central-1.on.aws",
			"eu-central-1":   "https://yfclo7xcv7xpaiifiavxgcufj40cvybz.lambda-url.eu-central-1.on.aws",
			"eu-west-1":      "https://saifj7wpwjyyw4wrmw7wddvrpe0lkldj.lambda-url.eu-west-1.on.aws",
			"eu-west-2":      "https://abblpbtumlm52cqxphgrr6ye4i0dxqpy.lambda-url.eu-west-2.on.aws",
			"eu-west-3":      "https://mmtb5nj7qhsx6nq6vwghclmagm0eqqyz.lambda-url.eu-west-3.on.aws",
			"eu-north-1":     "https://wfxizuyzs2rtyjzdhq2fyq5jcy0oanor.lambda-url.eu-north-1.on.aws",
			"sa-east-1":      "https://2qkkvujdov7mivcyjyzxcyopaq0qqtty.lambda-url.sa-east-1.on.aws",
			"af-south-1":     "https://ehyv57ssh7noe567tp7eirn6gq0piocq.lambda-url.af-south-1.on.aws",
			"ap-east-1":      "https://ms6lyqugjayy5be6zlbktzoveu0yjgdi.lambda-url.ap-east-1.on.aws",
			"eu-south-1":     "https://3xnmkbeggnbr273fyzpwjuwqpq0vhxav.lambda-url.eu-south-1.on.aws",
			"me-south-1":     "https://shknhkmv3irouru4xqlv7c76ly0zazie.lambda-url.me-south-1.on.aws",
			"me-central-1":   "https://shknhkmv3irouru4xqlv7c76ly0zazie.lambda-url.me-south-1.on.aws",
		},
		"prod": {
			"us-east-1":      "https://3cdv7cfi6v4moipclw265cwf340zmmal.lambda-url.us-east-1.on.aws",
			"us-gov-east-1":  "https://3cdv7cfi6v4moipclw265cwf340zmmal.lambda-url.us-east-1.on.aws",
			"us-east-2":      "https://orz7xtelhju3jt6vg5g5hgzpum0yvnvg.lambda-url.us-east-2.on.aws",
			"us-west-1":      "https://7j7zzjcfzkkpyt7kgmld4irvsi0tsqce.lambda-url.us-west-1.on.aws",
			"us-gov-west-1":  "https://7j7zzjcfzkkpyt7kgmld4irvsi0tsqce.lambda-url.us-west-1.on.aws",
			"us-west-2":      "https://igfvgspezaksdiwv42kjqgjeki0juyas.lambda-url.us-west-2.on.aws",
			"ap-south-1":     "https://ecdo4e7ow2aqqqnblqbiblqnh40ijioe.lambda-url.ap-south-1.on.aws",
			"ap-northeast-1": "https://jcadmlm3zauiwl3zfysic5fjgm0rcfic.lambda-url.ap-northeast-1.on.aws",
			"ap-northeast-2": "https://pram4fhpwb6eo56lsguo3kdt6u0lkrnh.lambda-url.ap-northeast-2.on.aws",
			"ap-northeast-3": "https://pram4fhpwb6eo56lsguo3kdt6u0lkrnh.lambda-url.ap-northeast-2.on.aws",
			"ap-southeast-1": "https://fnv6u3gbnlowkvcgni4dguvz4u0nbgfi.lambda-url.ap-southeast-1.on.aws",
			"ap-southeast-2": "https://3ym743znhpfuxyvqcg2ibacte40udnjt.lambda-url.ap-southeast-2.on.aws",
			"ap-southeast-3": "https://3ym743znhpfuxyvqcg2ibacte40udnjt.lambda-url.ap-southeast-2.on.aws",
			"ca-central-1":   "https://xvogk6do2xxvbrjkyuewi5oxka0tlqlt.lambda-url.ca-central-1.on.aws",
			"eu-central-1":   "https://i26gpd4kcsjeagq4u5f4p5shem0kwscl.lambda-url.eu-central-1.on.aws",
			"eu-west-1":      "https://pqhhioykmofxqkrhkhnuriurdq0tbscp.lambda-url.eu-west-1.on.aws",
			"eu-west-2":      "https://2tsqckhgcgajlo4rakav5573wm0ihbtx.lambda-url.eu-west-2.on.aws",
			"eu-west-3":      "https://jwicwq23xroeojyykxohomtpx40iwgcu.lambda-url.eu-west-3.on.aws",
			"eu-north-1":     "https://t2jzx2j3iorezuhhoyoopbbyzu0dgala.lambda-url.eu-north-1.on.aws",
			"sa-east-1":      "https://zj4cmbafkvb4x3m35zve2apkgy0sryxh.lambda-url.sa-east-1.on.aws",
			"af-south-1":     "https://7wvhgzlhtzkur6rmaw6xqhjuoe0fdvfp.lambda-url.af-south-1.on.aws",
			"ap-east-1":      "https://lf6mlrpettyfejnv723awan7b40niqks.lambda-url.ap-east-1.on.aws",
			"eu-south-1":     "https://3i46j5rqfnicg57zjdiywwi7xe0kyagj.lambda-url.eu-south-1.on.aws",
			"me-south-1":     "https://uwrlfmgkmc6qtaqf6hz2bvbpvq0ahmvb.lambda-url.me-south-1.on.aws",
			"me-central-1":   "https://uwrlfmgkmc6qtaqf6hz2bvbpvq0ahmvb.lambda-url.me-south-1.on.aws",
		},
	}

	region := os.Getenv("AWS_REGION")
	if fallbackRegion, hasFallback := regionMap[region]; hasFallback {
		region = fallbackRegion
	}

	if value, isDev := os.LookupEnv("SERVERLESS_PLATFORM_STAGE"); isDev {
		if value == "dev" {
			return fmt.Sprintf("%s/api/ingest", functionUrlMap["dev"][region])
		}
		return value
	}
	return fmt.Sprintf("%s/api/ingest", functionUrlMap["prod"][region])
}
