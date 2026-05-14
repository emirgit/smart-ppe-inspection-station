import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

const accountFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Ad en az 2 karakter olmalı.')
    .max(50, 'Ad en fazla 50 karakter olabilir.'),
  email: z
    .string()
    .email('Geçerli bir e-posta adresi girin.'),
})

type AccountFormValues = z.infer<typeof accountFormSchema>

const STORAGE_KEY = 'ppe-admin-account'

function getSavedAccount(): Partial<AccountFormValues> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

export function AccountForm() {
  const saved = getSavedAccount()

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: saved.name || 'PPE Admin',
      email: saved.email || 'admin@gebze.edu.tr',
    },
  })

  function onSubmit(data: AccountFormValues) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      toast.success('Hesap bilgileri güncellendi.')
    } catch {
      toast.error('Kaydedilemedi.')
    }
  }

  return (
    <div className='w-full max-w-lg'>
      <div className='mb-6'>
        <h2 className='text-lg font-semibold'>Hesap Bilgileri</h2>
        <p className='text-sm text-muted-foreground mt-1'>
          Admin panelinde görünen ad ve e-posta adresinizi güncelleyin.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Admin Adı</FormLabel>
                <FormControl>
                  <Input placeholder='PPE Admin' {...field} />
                </FormControl>
                <FormDescription>
                  Bu isim sidebar ve profil menüsünde görünür.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-posta</FormLabel>
                <FormControl>
                  <Input placeholder='admin@gebze.edu.tr' {...field} />
                </FormControl>
                <FormDescription>
                  Profil menüsünde görünen e-posta adresi.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

          <div className='flex gap-3'>
            <Button type='submit'>Kaydet</Button>
            <Button
              type='button'
              variant='outline'
              onClick={() => form.reset()}
            >
              Sıfırla
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
