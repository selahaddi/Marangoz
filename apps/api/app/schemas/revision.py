"""Doğal dil konuşma tabanlı iteratif revizyon şemaları."""

from pydantic import BaseModel, Field

from app.schemas.cabinet import CabinetConfig


class ChatMessage(BaseModel):
    """Sohbet geçmişindeki tek bir mesaj."""

    role: str = Field(description="'user' veya 'assistant'")
    content: str = Field(description="Mesaj metni")
    timestamp: str | None = Field(default=None, description="ISO formatında zaman damgası")
    diff_summary: list[str] = Field(default_factory=list, description="Bu adımda gerçekleşen değişikliklerin özeti")


class RevisionRequest(BaseModel):
    """Konuşma tabanlı revizyon istek gövdesi."""

    current_config: CabinetConfig = Field(description="Mevcut dolap parametreleri")
    instruction: str = Field(description="Kullanıcının doğal dilde revizyon komutu")
    history: list[ChatMessage] = Field(default_factory=list, description="Önceki sohbet geçmişi")


class RevisionResponseData(BaseModel):
    """Revizyon yanıt veri yapısı."""

    updated_config: CabinetConfig = Field(description="Güncellenmiş dolap parametreleri")
    assistant_message: str = Field(description="Yapay zekanın marangozluk açıklaması")
    diff_summary: list[str] = Field(default_factory=list, description="Değişen parametrelerin listesi")


class RevisionResponse(BaseModel):
    """Revizyon API genel yanıtı."""

    success: bool = True
    message: str = "Tasarım başarıyla revize edildi"
    data: RevisionResponseData

