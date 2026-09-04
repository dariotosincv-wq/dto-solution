import { authenticateRequest, clientsFromEnvironment, resolveCompanyContext, sendError, sendJson } from './_lib/companyLicensing.js'
import { publicVehicle, requireCompanyAdmin, vehicleInput } from './_lib/companyVehicles.js'
export default async function handler(request,response){
  try{const clients=clientsFromEnvironment(),user=await authenticateRequest(request,clients),context=await resolveCompanyContext(user.id,clients);requireCompanyAdmin(context)
    if(request.method==='GET'){const{data,error}=await clients.checkvan.from('checkvan_vehicles').select('*').eq('organization_id',context.organization.id).order('internal_code');if(error)throw new Error('VEHICLES_UNAVAILABLE');return sendJson(response,200,{items:(data??[]).map(publicVehicle)})}
    if(request.method==='POST'){const input=vehicleInput(request.body);const{data,error}=await clients.checkvan.from('checkvan_vehicles').insert({organization_id:context.organization.id,...input}).select('*').single();if(error)throw Object.assign(new Error(error.code==='23505'?'VEHICLE_PLATE_EXISTS':'VEHICLES_UNAVAILABLE'),{status:error.code==='23505'?409:503});return sendJson(response,201,publicVehicle(data))}
    return sendJson(response,405,{error:'METHOD_NOT_ALLOWED'})
  }catch(error){return sendError(response,error)}
}
