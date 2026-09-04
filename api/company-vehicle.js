import { authenticateRequest, clientsFromEnvironment, resolveCompanyContext, sendError, sendJson } from './_lib/companyLicensing.js'
import { publicVehicle, requireCompanyAdmin, uuid, vehicleInput } from './_lib/companyVehicles.js'
export default async function handler(request,response){
  try{const clients=clientsFromEnvironment(),user=await authenticateRequest(request,clients),context=await resolveCompanyContext(user.id,clients);requireCompanyAdmin(context);const id=request.query?.id;if(!uuid(id))return sendJson(response,400,{error:'INVALID_VEHICLE_ID'})
    if(request.method==='GET'){const{data,error}=await clients.checkvan.from('checkvan_vehicles').select('*').eq('id',id).eq('organization_id',context.organization.id).maybeSingle();if(error)throw new Error('VEHICLES_UNAVAILABLE');return data?sendJson(response,200,publicVehicle(data)):sendJson(response,404,{error:'VEHICLE_NOT_FOUND'})}
    if(request.method==='PATCH'){const input=vehicleInput(request.body);const{data,error}=await clients.checkvan.from('checkvan_vehicles').update({...input,updated_at:new Date().toISOString()}).eq('id',id).eq('organization_id',context.organization.id).select('*').maybeSingle();if(error)throw Object.assign(new Error(error.code==='23505'?'VEHICLE_PLATE_EXISTS':'VEHICLES_UNAVAILABLE'),{status:error.code==='23505'?409:503});return data?sendJson(response,200,publicVehicle(data)):sendJson(response,404,{error:'VEHICLE_NOT_FOUND'})}
    return sendJson(response,405,{error:'METHOD_NOT_ALLOWED'})
  }catch(error){return sendError(response,error)}
}
