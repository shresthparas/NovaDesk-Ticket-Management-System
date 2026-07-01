from fastapi import APIRouter, Depends, HTTPException, status
from .. import crud
from ..dependencies import get_current_user
from ..models import UserInDB, NotificationInDB

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("/", response_model=list[NotificationInDB])
async def get_my_notifications(current_user: UserInDB = Depends(get_current_user)):
    notifs = await crud.get_notifications(current_user.username)
    return [NotificationInDB.model_validate(n) for n in notifs]

@router.put("/{id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_notification_read(id: str, current_user: UserInDB = Depends(get_current_user)):
    marked = await crud.mark_notification_read(id)
    if not marked:
        raise HTTPException(status_code=404, detail="Notification not found")
    return

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(id: str, current_user: UserInDB = Depends(get_current_user)):
    deleted = await crud.delete_notification(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Notification not found")
    return

@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def clear_my_notifications(current_user: UserInDB = Depends(get_current_user)):
    await crud.clear_notifications(current_user.username)
    return
