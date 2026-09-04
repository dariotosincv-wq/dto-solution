import { clientsFromEnvironment,authenticateRequest,resolveCompanyContext,sendError,sendJson } from './_lib/companyLicensing.js'
import { requireCompanyAdmin,uuid } from './_lib/companyVehicles.js'
export default async function handler(request,response){
  if(request.method!=='POST')return sendJson(response,405,{error:'METHOD_NOT_ALLOWED'})
  try{const clients=clientsFromEnvironment(),user=await authenticateRequest(request,clients),context=await resolveCompanyContext(user.id,clients);requireCompanyAdmin(context)
    if(!uuid(request.body?.damage_id))return sendJson(response,400,{error:'INVALID_DAMAGE_ID'})
    const{data:damage,error}=await clients.checkvan.from('checkvan_vehicle_damages').select('photo_bucket,photo_object_path,photo_upload_status').eq('id',request.body.damage_id).eq('organization_id',context.organization.id).maybeSingle()
    if(error)throw new Error('DAMAGES_UNAVAILABLE');if(!damage||damage.photo_upload_status!=='AVAILABLE')throw Object.assign(new Error('DAMAGE_PHOTO_NOT_FOUND'),{status:404})
    const{data:signed,error:signError}=await clients.checkvan.storage.from(damage.photo_bucket).createSignedUrl(damage.photo_object_path,300)
    if(signError)throw new Error('PHOTO_AUTHORIZATION_FAILED');return sendJson(response,200,{signedUrl:signed.signedUrl,expiresIn:300})
  }catch(error){return sendError(response,error)}
}
